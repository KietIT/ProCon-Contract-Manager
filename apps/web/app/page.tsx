"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Calendar, Download, Zap, Bell, ChevronRight, Play } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function LandingPage() {
  const router = useRouter();
  const heroVisualRef = useRef<HTMLDivElement>(null);
  const heroContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Scroll reveal animation
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) entry.target.classList.add('active');
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    // Parallax effect on scroll
    const handleScroll = () => {
      const scrolled = window.scrollY;
      if (heroVisualRef.current && heroContainerRef.current && scrolled < 1000) {
        const rotationX = Math.min(scrolled * 0.05, 15);
        const rotationY = Math.min(scrolled * -0.05, -15);
        const scale = 1 - (scrolled * 0.0002);
        heroVisualRef.current.style.transform = `rotateX(${rotationX}deg) rotateY(${rotationY}deg) scale(${scale})`;
        heroContainerRef.current.style.transform = `translateY(${scrolled * 0.1}px)`;
      }
    };

    // Particle mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      const particles = document.querySelectorAll('.particle');
      const mouseX = e.clientX / window.innerWidth;
      const mouseY = e.clientY / window.innerHeight;
      particles.forEach((p, index) => {
        const speed = (index + 1) * 20;
        const x = (mouseX - 0.5) * speed;
        const y = (mouseY - 0.5) * speed;
        (p as HTMLElement).style.transform = `translate(${x}px, ${y}px)`;
      });
    };

    window.addEventListener('scroll', handleScroll);
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.removeEventListener('mousemove', handleMouseMove);
      observer.disconnect();
    };
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-trust-blue text-white overflow-x-hidden selection:bg-accent-cyan selection:text-trust-blue">
      {/* Background Effects */}
      <div className="fixed inset-0 bg-grid pointer-events-none z-0"></div>
      <div className="fixed inset-0 bg-gradient-to-b from-transparent via-trust-blue/50 to-trust-blue pointer-events-none z-0"></div>
      
      {/* Particles */}
      <div className="particle w-1 h-1 top-1/4 left-1/4 animate-pulse-slow fixed pointer-events-none z-0"></div>
      <div className="particle w-2 h-2 top-1/2 left-1/3 animate-float fixed pointer-events-none z-0" style={{animationDelay: '1s'}}></div>
      <div className="particle w-1 h-1 top-3/4 left-2/3 animate-pulse-slow fixed pointer-events-none z-0" style={{animationDelay: '2s'}}></div>
      <div className="particle w-1.5 h-1.5 top-10 right-1/4 animate-float fixed pointer-events-none z-0"></div>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-trust-blue/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <div className="w-8 h-8 bg-accent-cyan rounded flex items-center justify-center">
                <img src="/favicon.svg" alt="TAR AI" className="w-5 h-5 object-contain" />
              </div>
              <span className="text-xl font-extrabold tracking-tight uppercase">ProCon</span>
            </div>
            <div className="hidden md:flex items-center space-x-8 text-sm font-medium text-gray-300">
              <button onClick={() => scrollTo('features')} className="hover:text-accent-cyan transition-colors">Product</button>
              <button onClick={() => scrollTo('workflow')} className="hover:text-accent-cyan transition-colors">Solutions</button>
              <button onClick={() => scrollTo('enterprise')} className="hover:text-accent-cyan transition-colors">Enterprise</button>
            </div>
            <div className="flex items-center gap-6">
              <ThemeToggle />
              <Link href="/login" className="hidden sm:block text-sm font-medium text-gray-300 hover:text-white transition-colors">
                Login
              </Link>
              <Link
                href="/login"
                className="bg-accent-cyan text-trust-blue px-5 py-2.5 rounded-md font-bold text-sm hover:brightness-110 transition-all glow-cyan flex items-center gap-2"
              >
                Request Demo
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="relative z-10">
        {/* Hero Section */}
        <section className="relative pt-20 pb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col lg:flex-row items-center gap-16">
              <div className="flex-1 text-center lg:text-left">
                <div className="inline-flex items-center px-3 py-1 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan text-xs font-bold tracking-widest uppercase mb-6">
                  <span className="w-2 h-2 bg-accent-cyan rounded-full mr-2 animate-pulse"></span>
                  New: AI Milestone Tracking
                </div>
                <h1 className="text-5xl lg:text-7xl font-extrabold leading-tight mb-8">
                  AI-Powered <br/>
                  <span className="text-accent-cyan glow-text">Construction</span> <br/>
                  Contract Management
                </h1>
                <p className="text-xl text-gray-400 max-w-2xl mx-auto lg:mx-0 mb-10 leading-relaxed">
                  Automate parsing and SLA tracking to mitigate risk and boost efficiency. The only platform built for the complexities of modern construction.
                </p>
                <div className="flex flex-wrap justify-center lg:justify-start gap-4">
                  <Link
                    href="/login"
                    className="px-8 py-4 bg-accent-cyan text-trust-blue rounded-lg font-bold text-lg hover:scale-105 transition-transform glow-cyan flex items-center gap-2"
                  >
                    Request Demo
                    <ChevronRight className="w-5 h-5" />
                  </Link>
                  <button
                    onClick={() => scrollTo('workflow')}
                    className="px-8 py-4 border border-white/20 hover:bg-white/5 rounded-lg font-bold text-lg transition-colors flex items-center gap-2"
                  >
                    <Play className="w-5 h-5 fill-white" />
                    Watch Overview
                  </button>
                </div>
              </div>
              
              {/* Hero Visual with 3D Effect */}
              <div ref={heroContainerRef} className="flex-1 w-full max-w-2xl transition-all duration-1000 ease-out" style={{perspective: '1000px'}}>
                <div 
                  ref={heroVisualRef}
                  className="relative aspect-square w-full rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent flex items-center justify-center backdrop-blur-sm overflow-hidden transition-transform duration-100"
                  style={{transformStyle: 'preserve-3d'}}
                >
                  <div className="absolute inset-8 border border-accent-cyan/20 rounded-xl overflow-hidden shadow-2xl bg-trust-blue/40">
                    <div className="w-full h-8 bg-white/5 border-b border-white/10 flex items-center px-4 gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
                      <div className="w-2 h-2 rounded-full bg-yellow-500/50"></div>
                      <div className="w-2 h-2 rounded-full bg-green-500/50"></div>
                      <span className="ml-2 text-xs text-gray-500 font-mono">ProCon Command Dashboard</span>
                    </div>
                    <div className="p-6 space-y-4">
                      {/* Mock KPI cards */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="h-16 bg-white/5 rounded-lg border border-accent-cyan/20 p-3 flex flex-col justify-between">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Contracts</span>
                          <span className="text-xl font-bold text-accent-cyan">24</span>
                        </div>
                        <div className="h-16 bg-white/5 rounded-lg border border-red-500/20 p-3 flex flex-col justify-between">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Overdue</span>
                          <span className="text-xl font-bold text-red-400">3</span>
                        </div>
                      </div>
                      {/* Mock RAG chart */}
                      <div className="h-24 bg-white/5 rounded-lg border border-white/5 flex items-center justify-center gap-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-green-400"></div>
                          <span className="text-xs text-gray-400">18 Green</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                          <span className="text-xs text-gray-400">4 Amber</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-400"></div>
                          <span className="text-xs text-gray-400">2 Red</span>
                        </div>
                      </div>
                      {/* Mock progress bars */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Budget Burn</span>
                          <span className="text-accent-cyan">68%</span>
                        </div>
                        <div className="h-2 bg-accent-cyan/20 w-full rounded-full">
                          <div className="h-full bg-accent-cyan w-[68%] rounded-full glow-cyan transition-all duration-1000"></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Milestones Complete</span>
                          <span className="text-green-400">74%</span>
                        </div>
                        <div className="h-2 bg-green-500/20 w-full rounded-full">
                          <div className="h-full bg-green-400 w-[74%] rounded-full"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute h-[1px] w-full top-1/4 bg-gradient-to-r from-transparent via-accent-cyan/30 to-transparent"></div>
                    <div className="absolute h-[1px] w-full top-1/2 bg-gradient-to-r from-transparent via-accent-cyan/30 to-transparent"></div>
                    <div className="absolute h-[1px] w-full top-3/4 bg-gradient-to-r from-transparent via-accent-cyan/30 to-transparent"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust Logos */}
        <section className="py-16 border-y border-white/5 bg-trust-blue/30 reveal">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-xs font-bold tracking-[0.2em] text-gray-500 uppercase mb-10">Trusted by Leaders in Construction</p>
            <div className="flex flex-wrap justify-center gap-8 md:gap-16 items-center opacity-60">
              <span className="text-2xl font-black italic tracking-tighter">PetroAlpha</span>
              <span className="text-2xl font-black italic tracking-tighter uppercase border-x px-4 border-white/10">TechBuild</span>
              <span className="text-2xl font-black italic tracking-tighter">OilCorp</span>
              <span className="text-2xl font-black italic tracking-tighter">MegaTAR</span>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-32 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-24 reveal">
              <h2 className="text-4xl md:text-5xl font-extrabold mb-6">Enterprise-grade capabilities</h2>
              <p className="text-gray-400 max-w-2xl mx-auto text-lg leading-relaxed">
                Everything you need to manage complex multi-stakeholder contracts from pre-con to handover.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-accent-cyan/50 transition-all duration-500 group reveal cursor-pointer" onClick={() => router.push('/workspace')}>
                <div className="w-12 h-12 bg-accent-cyan/10 rounded-lg flex items-center justify-center mb-6 text-accent-cyan group-hover:bg-accent-cyan group-hover:text-trust-blue transition-all">
                  <Download className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-4">AI Contract Parsing</h3>
                <p className="text-gray-400 leading-relaxed">Automatically extract key clauses, liabilities, and critical data from thousands of pages in seconds.</p>
                <div className="mt-4 text-accent-cyan text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Try it now <ChevronRight className="w-4 h-4" />
                </div>
              </div>
              <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-accent-cyan/50 transition-all duration-500 group reveal cursor-pointer" style={{transitionDelay: '100ms'}} onClick={() => router.push('/workspace')}>
                <div className="w-12 h-12 bg-accent-cyan/10 rounded-lg flex items-center justify-center mb-6 text-accent-cyan group-hover:bg-accent-cyan group-hover:text-trust-blue transition-all">
                  <Activity className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-4">Automated SLA Monitoring</h3>
                <p className="text-gray-400 leading-relaxed">Real-time tracking of service level agreements and compliance triggers to prevent costly disputes.</p>
                <div className="mt-4 text-accent-cyan text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  View Dashboard <ChevronRight className="w-4 h-4" />
                </div>
              </div>
              <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-accent-cyan/50 transition-all duration-500 group reveal cursor-pointer" style={{transitionDelay: '200ms'}} onClick={() => router.push('/approvals')}>
                <div className="w-12 h-12 bg-accent-cyan/10 rounded-lg flex items-center justify-center mb-6 text-accent-cyan group-hover:bg-accent-cyan group-hover:text-trust-blue transition-all">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-4">Smart Milestones & Approvals</h3>
                <p className="text-gray-400 leading-relaxed">Streamline project phases with automated notification workflows for critical approval deadlines.</p>
                <div className="mt-4 text-accent-cyan text-sm font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Manage Approvals <ChevronRight className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Workflow Section */}
        <section id="workflow" className="py-32 bg-slate-gray/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-20 reveal">
              <h2 className="text-4xl font-extrabold mb-4">Streamlined Intelligence</h2>
              <div className="w-24 h-1 bg-accent-cyan mx-auto rounded-full glow-cyan"></div>
            </div>
            <div className="flex flex-col md:flex-row items-start justify-between gap-12 relative">
              {/* Connector line */}
              <div className="hidden md:block absolute top-10 left-[16%] right-[16%] h-[2px] bg-gradient-to-r from-accent-cyan/30 via-accent-cyan/50 to-accent-cyan/30"></div>
              <div className="flex-1 text-center z-10 reveal">
                <div className="w-20 h-20 rounded-full bg-trust-blue border border-accent-cyan/30 flex items-center justify-center mx-auto mb-8 shadow-xl ring-4 ring-accent-cyan/10">
                  <Download className="w-8 h-8 text-accent-cyan" />
                </div>
                <h4 className="text-lg font-bold mb-3">1. Upload PDF</h4>
                <p className="text-sm text-gray-400">Securely upload construction contracts and addenda in bulk.</p>
              </div>
              <div className="flex-1 text-center z-10 reveal" style={{transitionDelay: '150ms'}}>
                <div className="w-20 h-20 rounded-full bg-trust-blue border border-accent-cyan/30 flex items-center justify-center mx-auto mb-8 shadow-xl ring-4 ring-accent-cyan/10">
                  <Zap className="w-8 h-8 text-accent-cyan" />
                </div>
                <h4 className="text-lg font-bold mb-3">2. AI Extracts Data</h4>
                <p className="text-sm text-gray-400">Our engine identifies critical dates, obligations, and risk factors.</p>
              </div>
              <div className="flex-1 text-center z-10 reveal" style={{transitionDelay: '300ms'}}>
                <div className="w-20 h-20 rounded-full bg-trust-blue border border-accent-cyan/30 flex items-center justify-center mx-auto mb-8 shadow-xl ring-4 ring-accent-cyan/10">
                  <Bell className="w-8 h-8 text-accent-cyan" />
                </div>
                <h4 className="text-lg font-bold mb-3">3. Track SLAs</h4>
                <p className="text-sm text-gray-400">Get proactive alerts for compliance and upcoming milestones.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Enterprise Section */}
        <section id="enterprise" className="py-32 relative reveal">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center px-3 py-1 rounded-full border border-accent-cyan/30 bg-accent-cyan/10 text-accent-cyan text-xs font-bold tracking-widest uppercase mb-6">
                  Enterprise Ready
                </div>
                <h2 className="text-4xl font-extrabold mb-6">Built for Multi-Org ProCon Projects</h2>
                <p className="text-gray-400 mb-8 leading-relaxed">
                  Full multi-organisation isolation with role-based access control. Owner orgs, EPC contractors, and PMCs each see only their relevant data.
                </p>
                <ul className="space-y-4">
                  {['ProCon Manager full oversight', 'Contractor self-service portal', 'PMO reporting dashboard', 'Approval chain automation', 'Email SLA notifications'].map(item => (
                    <li key={item} className="flex items-center gap-3 text-gray-300">
                      <div className="w-5 h-5 rounded-full bg-accent-cyan/20 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-accent-cyan"></div>
                      </div>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Contracts Parsed', value: '10,000+', color: 'text-accent-cyan' },
                  { label: 'Hours Saved', value: '50,000+', color: 'text-green-400' },
                  { label: 'SLA Compliance', value: '99.2%', color: 'text-amber-400' },
                  { label: 'Orgs Onboarded', value: '120+', color: 'text-purple-400' },
                ].map(stat => (
                  <div key={stat.label} className="p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <div className={`text-3xl font-black mb-2 ${stat.color}`}>{stat.value}</div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 reveal">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-cyan-900 to-trust-blue p-12 md:p-20 text-center border border-white/10">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-accent-cyan/20 blur-[100px] rounded-full"></div>
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-accent-cyan/10 blur-[100px] rounded-full"></div>
              <h2 className="text-4xl md:text-5xl font-black mb-6 relative z-10">Ready to modernize your contracts?</h2>
              <p className="text-gray-300 text-lg mb-10 max-w-2xl mx-auto relative z-10">
                Join the world&apos;s largest construction firms using Procon AI to gain total visibility into project obligations.
              </p>
              <div className="flex flex-wrap justify-center gap-4 relative z-10">
                <Link href="/workspace" className="px-10 py-4 bg-accent-cyan text-trust-blue rounded-lg font-bold text-lg hover:brightness-110 transition-all glow-cyan flex items-center gap-2">
                  Get Started Free
                  <ChevronRight className="w-5 h-5" />
                </Link>
                <a href="mailto:sales@tar.ai" className="px-10 py-4 border border-white/30 bg-white/5 backdrop-blur-sm rounded-lg font-bold text-lg hover:bg-white/10 transition-colors">
                  Contact Sales
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative bg-trust-blue border-t border-white/5">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent-cyan/30 to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-12">
            {/* Brand */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-accent-cyan rounded flex items-center justify-center">
                  <img src="/favicon.svg" alt="ProCon" className="w-4 h-4 object-contain" />
                </div>
                <span className="text-lg font-extrabold tracking-tight uppercase text-white">ProCon</span>
              </div>
              <p className="text-sm text-gray-400 max-w-sm leading-relaxed mb-6">
                AI-powered contract management platform built for the complexities of modern construction and turnaround projects.
              </p>
              <div className="flex items-center gap-4">
                <Link
                  href="/login"
                  className="px-5 py-2 bg-accent-cyan/10 border border-accent-cyan/20 text-accent-cyan rounded-lg text-sm font-semibold hover:bg-accent-cyan/20 transition-colors"
                >
                  Request Demo
                </Link>
              </div>
            </div>

            {/* Product */}
            <div className="md:col-span-3">
              <h5 className="font-bold mb-5 text-xs uppercase tracking-widest text-gray-400">Product</h5>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => scrollTo('features')} className="text-gray-300 hover:text-accent-cyan transition-colors">AI Contract Parsing</button></li>
                <li><button onClick={() => scrollTo('features')} className="text-gray-300 hover:text-accent-cyan transition-colors">SLA Monitoring</button></li>
                <li><button onClick={() => scrollTo('features')} className="text-gray-300 hover:text-accent-cyan transition-colors">Milestones &amp; Approvals</button></li>
                <li><button onClick={() => scrollTo('workflow')} className="text-gray-300 hover:text-accent-cyan transition-colors">How It Works</button></li>
              </ul>
            </div>

            {/* Platform */}
            <div className="md:col-span-2">
              <h5 className="font-bold mb-5 text-xs uppercase tracking-widest text-gray-400">Platform</h5>
              <ul className="space-y-3 text-sm">
                <li><Link href="/workspace" className="text-gray-300 hover:text-accent-cyan transition-colors">Workspace</Link></li>
                <li><Link href="/approvals" className="text-gray-300 hover:text-accent-cyan transition-colors">Approvals</Link></li>
                <li><Link href="/login" className="text-gray-300 hover:text-accent-cyan transition-colors">Sign In</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="md:col-span-2">
              <h5 className="font-bold mb-5 text-xs uppercase tracking-widest text-gray-400">Company</h5>
              <ul className="space-y-3 text-sm">
                <li><button onClick={() => scrollTo('enterprise')} className="text-gray-300 hover:text-accent-cyan transition-colors">About</button></li>
                <li><a href="mailto:contact@procon.ai" className="text-gray-300 hover:text-accent-cyan transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} ProCon Technologies. All rights reserved.</p>
            <div className="flex items-center gap-6 text-xs text-gray-500">
              <span>Privacy Policy</span>
              <span>Terms of Service</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}