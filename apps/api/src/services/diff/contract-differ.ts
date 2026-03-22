import { prisma } from '../../lib/prisma';
import { downloadFromS3 } from '../storage';
import { extractFromPdfWithPages, extractTextFromFile } from '../ai/file-extractor';
import { computeTextDiff } from './text-differ';
import type { DiffSegment, DiffSummary } from './text-differ';

interface VersionFile {
  fileKey: string;
  fileMimeType: string;
  versionNumber: number;
  versionId?: string;
}

export interface DiffResponse {
  segments: DiffSegment[];
  summary: DiffSummary;
  fileUrlA: string;
  fileUrlB: string;
  versionA: number;
  versionB: number;
  corrupted?: boolean;
}

async function extractWithPages(buffer: Buffer, mimeType: string) {
  if (mimeType === 'application/pdf') {
    try {
      return await extractFromPdfWithPages(buffer);
    } catch {
      const text = await extractTextFromFile(buffer, mimeType);
      return { text, pages: [{ pageNum: 1, text, startOffset: 0 }] };
    }
  }

  const text = await extractTextFromFile(buffer, mimeType);
  return { text, pages: [{ pageNum: 1, text, startOffset: 0 }] };
}

async function resolveVersionFile(
  contractId: string,
  version: number,
  contract: { currentVersion: number; fileKey: string | null; fileMimeType: string | null }
): Promise<VersionFile> {
  if (version === contract.currentVersion) {
    if (!contract.fileKey) throw new Error(`No file for current version ${version}`);
    return {
      fileKey: contract.fileKey,
      fileMimeType: contract.fileMimeType ?? 'application/pdf',
      versionNumber: version,
    };
  }

  const archived = await prisma.contractVersion.findFirst({
    where: { contractId, versionNumber: version },
    select: { id: true, fileKey: true, fileMimeType: true, versionNumber: true },
  });

  if (!archived) throw new Error(`Version ${version} not found`);

  return {
    fileKey: archived.fileKey,
    fileMimeType: archived.fileMimeType,
    versionNumber: archived.versionNumber,
    versionId: archived.id,
  };
}

export async function computeContractDiff(
  contractId: string,
  versionA: number,
  versionB: number
): Promise<DiffResponse> {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    select: {
      id: true,
      currentVersion: true,
      fileKey: true,
      fileMimeType: true,
    },
  });

  if (!contract) throw new Error('Contract not found');

  const fileA = await resolveVersionFile(contractId, versionA, contract);
  const fileB = await resolveVersionFile(contractId, versionB, contract);

  const [bufferA, bufferB] = await Promise.all([
    downloadFromS3(fileA.fileKey),
    downloadFromS3(fileB.fileKey),
  ]);

  // Detect corrupted versions: files are binary-identical despite being different versions
  // This happens when a version was uploaded with the same filename before the overwrite fix
  if (Buffer.compare(bufferA, bufferB) === 0 && versionA !== versionB) {
    console.warn(`[diff] Corrupted version data detected for contract ${contractId}: v${versionA} and v${versionB} have identical file content.`);

    // Auto-repair: delete the corrupted archived version record and reset version counter
    await repairCorruptedVersions(contractId);

    return {
      segments: [],
      summary: { additions: 0, deletions: 0, modifications: 0 },
      fileUrlA: '',
      fileUrlB: '',
      versionA,
      versionB,
      corrupted: true,
    };
  }

  const [docA, docB] = await Promise.all([
    extractWithPages(bufferA, fileA.fileMimeType),
    extractWithPages(bufferB, fileB.fileMimeType),
  ]);

  const { segments, summary } = computeTextDiff(
    { text: docA.text, pages: docA.pages },
    { text: docB.text, pages: docB.pages }
  );

  // Build file URLs — each version gets a unique, cache-safe URL
  function buildFileUrl(version: number, file: VersionFile): string {
    if (version === contract!.currentVersion) {
      // Append version number to bust browser cache when current file changes
      return `/api/v1/contracts/${contractId}/file?v=${version}`;
    }
    if (file.versionId) {
      return `/api/v1/contracts/${contractId}/versions/${file.versionId}/file`;
    }
    // Fallback: serve file directly by encoding the fileKey as query param
    return `/api/v1/contracts/${contractId}/file?key=${encodeURIComponent(file.fileKey)}`;
  }

  const fileUrlA = buildFileUrl(versionA, fileA);
  const fileUrlB = buildFileUrl(versionB, fileB);

  return {
    segments,
    summary,
    fileUrlA,
    fileUrlB,
    versionA,
    versionB,
  };
}

/**
 * Auto-repair corrupted version records.
 * Deletes archived versions whose file content is identical to the current version
 * (caused by same-filename overwrite bug) and resets the version counter.
 */
async function repairCorruptedVersions(contractId: string): Promise<void> {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      select: { id: true, fileKey: true, currentVersion: true },
    });
    if (!contract?.fileKey) return;

    const currentBuffer = await downloadFromS3(contract.fileKey);
    const versions = await prisma.contractVersion.findMany({
      where: { contractId },
      orderBy: { versionNumber: 'asc' },
    });

    const corruptedIds: string[] = [];
    for (const v of versions) {
      try {
        const vBuffer = await downloadFromS3(v.fileKey);
        if (Buffer.compare(currentBuffer, vBuffer) === 0) {
          corruptedIds.push(v.id);
        }
      } catch {
        // File doesn't exist at all — also corrupted
        corruptedIds.push(v.id);
      }
    }

    if (corruptedIds.length === 0) return;

    // Delete corrupted version records
    await prisma.contractVersion.deleteMany({
      where: { id: { in: corruptedIds } },
    });

    // Reset version counter: remaining versions count + 1
    const remaining = await prisma.contractVersion.count({ where: { contractId } });
    await prisma.contract.update({
      where: { id: contractId },
      data: { currentVersion: remaining + 1 },
    });

    console.log(`[diff] Auto-repaired contract ${contractId}: removed ${corruptedIds.length} corrupted version(s), reset to v${remaining + 1}`);
  } catch (err) {
    console.error('[diff] Auto-repair failed:', err);
  }
}
