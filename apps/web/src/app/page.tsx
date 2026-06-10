'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Fragment, useEffect } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  Factory,
  LayoutDashboard,
  Lock,
  Package,
  Settings,
  ShoppingCart,
  Star,
  Truck,
  UsersRound,
  Wallet,
  Warehouse,
  Zap
} from 'lucide-react';

import { FaqSection } from '@/components/landing/faq';
import { Navbar } from '@/components/landing/navbar';
import { AnimatedCounter } from '@/components/landing/animated-counter';

/* ─── Data ──────────────────────────────────────────────────────────────── */

const ticker = [
  '🧊 Batch Production', '📦 GRN & Procurement', '🏪 Multi-Branch', '📊 Live Dashboards',
  '🔒 Role-Based Access', '💰 Cost Accounting', '🧪 Quality Control', '📋 Audit Trail',
  '🚛 Stock Transfers', '💵 Full Accounting', '🏭 Shift Management', '📈 Variance Reports',
  '🧊 Batch Production', '📦 GRN & Procurement', '🏪 Multi-Branch', '📊 Live Dashboards',
  '🔒 Role-Based Access', '💰 Cost Accounting', '🧪 Quality Control', '📋 Audit Trail',
  '🚛 Stock Transfers', '💵 Full Accounting', '🏭 Shift Management', '📈 Variance Reports',
];

const productionStages = [
  { id: 'raw',      icon: '🥛',  label: 'Raw Materials', metric: '2.4t',    unit: 'Received Today', bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    badgeBorder: 'border-blue-400/40',    metricColor: 'text-blue-400'    },
  { id: 'past',     icon: '🌡️',  label: 'Pasteurise',    metric: '98°C',    unit: 'HTST',           bg: 'bg-violet-500/10',  border: 'border-violet-500/25',  badgeBorder: 'border-violet-400/40',  metricColor: 'text-violet-400'  },
  { id: 'homog',    icon: '🌀',  label: 'Homogenise',    metric: '250bar',  unit: 'Pressure',       bg: 'bg-cyan-500/10',    border: 'border-cyan-500/25',    badgeBorder: 'border-cyan-400/40',    metricColor: 'text-cyan-400'    },
  { id: 'freeze',   icon: '❄️',  label: 'Freeze',        metric: '-4°C',    unit: 'Continuous',     bg: 'bg-sky-500/10',     border: 'border-sky-500/25',     badgeBorder: 'border-sky-400/40',     metricColor: 'text-sky-400'     },
  { id: 'mould',    icon: '🍦',  label: 'Moulding',      metric: '1,240',   unit: 'Units / hr',     bg: 'bg-orange-500/10',  border: 'border-orange-500/25',  badgeBorder: 'border-orange-400/40',  metricColor: 'text-orange-400'  },
  { id: 'harden',   icon: '🧊',  label: 'Hardening',     metric: '-35°C',   unit: 'IQF Tunnel',     bg: 'bg-indigo-500/10',  border: 'border-indigo-500/25',  badgeBorder: 'border-indigo-400/40',  metricColor: 'text-indigo-400'  },
  { id: 'pack',     icon: '📦',  label: 'Packaging',     metric: '98.2%',   unit: 'Fill Rate',      bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', badgeBorder: 'border-emerald-400/40', metricColor: 'text-emerald-400' },
  { id: 'dispatch', icon: '🚛',  label: 'Dispatch',      metric: '5',       unit: 'Routes Active',  bg: 'bg-pink-500/10',    border: 'border-pink-500/25',    badgeBorder: 'border-pink-400/40',    metricColor: 'text-pink-400'    },
] as const;

const liveMetrics = [
  { label: "Today's Output", value: '12,450',   sub: 'cones produced',  color: 'text-orange'      },
  { label: 'Batch Yield',    value: '97.8%',    sub: 'vs 95% target',   color: 'text-emerald-400' },
  { label: 'Stock Coverage', value: '8.4 days', sub: 'raw materials',   color: 'text-blue-400'    },
  { label: 'Active Workers', value: '34',        sub: 'across 2 shifts', color: 'text-violet-400'  },
];

const statsData = [
  { value: 25, suffix: '+', label: 'ERP Modules' },
  { value: 9, suffix: '', label: 'User Roles' },
  { value: 100, suffix: '%', label: 'Real-Time Sync' },
  { value: 4, suffix: '-Level', label: 'Approvals' },
];

const modules = [
  { icon: LayoutDashboard, label: 'Dashboard', color: 'from-orange-500 to-amber-400', desc: 'Live KPIs across all departments' },
  { icon: Truck, label: 'Procurement', color: 'from-blue-500 to-cyan-400', desc: 'PR → RFQ → PO → GRN workflow' },
  { icon: Warehouse, label: 'Inventory', color: 'from-emerald-500 to-green-400', desc: 'Raw materials, WIP & finished goods' },
  { icon: Factory, label: 'Production', color: 'from-violet-500 to-purple-400', desc: 'Recipe-driven batch manufacturing' },
  { icon: Building2, label: 'Branch Ops', color: 'from-pink-500 to-rose-400', desc: 'Independent branch management' },
  { icon: ShoppingCart, label: 'Sales', color: 'from-yellow-500 to-orange-400', desc: 'Quotation → Order → Invoice' },
  { icon: Wallet, label: 'Finance', color: 'from-teal-500 to-emerald-400', desc: 'Full double-entry accounting' },
  { icon: UsersRound, label: 'HR & Payroll', color: 'from-indigo-500 to-blue-400', desc: 'Staff, shifts & payroll processing' },
  { icon: BarChart3, label: 'Reports', color: 'from-orange-600 to-red-400', desc: 'Management-ready analytics' },
  { icon: Settings, label: 'Settings', color: 'from-slate-500 to-gray-400', desc: 'Roles, permissions & master data' },
  { icon: DollarSign, label: 'Cost Accounting', color: 'from-amber-600 to-yellow-400', desc: 'Cost per cone, batch & product line' },
  { icon: ClipboardCheck, label: 'Quality Control', color: 'from-green-600 to-lime-400', desc: 'QC at every production stage' },
];

const workflow = [
  { step: '01', title: 'Supplier Delivers', desc: 'Raw materials received and verified via GRN with quality inspection', icon: '🚛' },
  { step: '02', title: 'Stock In Warehouse', desc: 'Inventory updated in real-time across all warehouses and cold rooms', icon: '🏪' },
  { step: '03', title: 'Production Batch', desc: 'Recipe triggered, materials issued, shift started with targets set', icon: '🏭' },
  { step: '04', title: 'Quality Check', desc: 'Finished goods inspected before transfer to prevent defect dispatch', icon: '🧪' },
  { step: '05', title: 'Branch Transfer', desc: 'Approved stock transferred to branches with full transfer documentation', icon: '🚚' },
  { step: '06', title: 'Sales & Invoicing', desc: 'Branch records sales, shift closes, and invoices are auto-generated', icon: '💳' },
  { step: '07', title: 'Finance & Reports', desc: 'Income statement, costing variance, and management reports generated', icon: '📊' },
];

const roles = [
  { role: 'Store Keeper', perms: ['Inventory only', 'No finance access', 'Stock receives & issues'], color: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700' },
  { role: 'Production Mgr', perms: ['Batch management', 'Material consumption', 'Quality records'], color: 'bg-violet-500/15 border-violet-500/30 text-violet-700' },
  { role: 'Sales Rep', perms: ['Customer orders', 'Invoicing', 'View stock (not cost)'], color: 'bg-blue-500/15 border-blue-500/30 text-blue-700' },
  { role: 'Branch Manager', perms: ['Branch sales', 'Expense approval', 'Local inventory'], color: 'bg-pink-500/15 border-pink-500/30 text-pink-700' },
  { role: 'Accountant', perms: ['Full financial access', 'Manual sales journals', 'Budget mgmt'], color: 'bg-amber-500/15 border-amber-500/30 text-amber-700' },
  { role: 'Procurement', perms: ['Purchase orders', 'Supplier mgmt', 'Cannot approve payments'], color: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-700' },
];

const approvalLevels = [
  { level: '1', title: 'Supervisor', trigger: 'Minor stock movements', color: 'bg-blue-500' },
  { level: '2', title: 'Dept Manager', trigger: 'Purchase orders & transfers', color: 'bg-violet-500' },
  { level: '3', title: 'Finance Manager', trigger: 'Payments & credit sales', color: 'bg-orange-500' },
  { level: '4', title: 'Managing Director', trigger: 'Asset purchases & budget changes', color: 'bg-red-500' },
];

/* ─── Component ───────────────────────────────────────────────────────────── */
export default function HomePage() {
  useEffect(() => {
    const targets = document.querySelectorAll('[data-animate]');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add('in-view');
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    );
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative">
      <Navbar />

      {/* ═══ HERO ═══ */}
      <section className="relative flex min-h-screen flex-col overflow-hidden bg-[#0D0500]">
        {/* Background photo */}
        <Image
          src="https://images.unsplash.com/photo-1488900128323-21503983a07e?auto=format&fit=crop&w=1800&q=80"
          alt=""
          fill
          priority
          className="pointer-events-none object-cover object-center opacity-[0.9]"
        />
        {/* Dark vignette so text stays readable */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0D0500]/60 via-[#0D0500]/40 to-[#0D0500]" />

        {/* Ambient blobs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-[600px] w-[600px] animate-blob rounded-full bg-orange/20 blur-[120px]" />
          <div className="absolute -right-32 top-1/4 h-[500px] w-[500px] animate-blob rounded-full bg-amber-500/15 blur-[100px]" style={{ animationDelay: '2s' }} />
          <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] animate-blob rounded-full bg-deepOrange/10 blur-[80px]" style={{ animationDelay: '4s' }} />
        </div>
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(249,115,22,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.6) 1px, transparent 1px)', backgroundSize: '60px 60px' }}
        />

        {/* ─── Compact text header ─── */}
        <div className="relative z-10 flex flex-col items-center pt-28 text-center">
          <div className="mb-5 inline-flex animate-slide-up items-center gap-2 rounded-full border border-orange/30 bg-orange/10 px-4 py-2 text-sm font-medium text-orange">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange" />
            </span>
            Ice Cream Manufacturing ERP — Live on Production
          </div>

          <h1
            className="animate-slide-up font-display max-w-3xl px-4 text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl"
            style={{ animationDelay: '0.15s' }}
          >
            From milk to shelf —{' '}
            <span className="grad-text">every stage automated</span>
          </h1>

          <p
            className="animate-slide-up mt-4 max-w-xl px-4 text-base text-white/50 sm:text-lg"
            style={{ animationDelay: '0.28s' }}
          >
            Procurement · Production · Quality · Branches · Finance · HR — one system, zero gaps
          </p>

          <div className="animate-slide-up mt-7 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: '0.4s' }}>
            <Link
              href="/auth/login"
              className="btn-shimmer group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-orange px-7 py-3.5 text-sm font-semibold text-white shadow-[0_0_30px_rgba(249,115,22,0.4)] transition-all duration-300 hover:bg-deepOrange hover:shadow-[0_0_50px_rgba(249,115,22,0.6)]"
            >
              Launch Dashboard
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a
              href="#modules"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-semibold text-white/80 transition-all duration-300 hover:border-orange/30 hover:bg-white/10 hover:text-white"
            >
              See All Modules
            </a>
          </div>
        </div>

        {/* ─── Interactive Production Pipeline ─── */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 pb-14 pt-14">
          <div className="w-full max-w-6xl">

            {/* Stage label above pipeline */}
            <p className="mb-6 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-white/25">Live Factory Floor — Today&apos;s Production Run</p>

            {/* Pipeline — icon row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: productionStages.map((_, i) => i === productionStages.length - 1 ? '80px' : '80px 1fr').join(' '),
                alignItems: 'center',
              }}
            >
              {productionStages.map((stage, i) => (
                <Fragment key={stage.id}>
                  {/* Stage icon card */}
                  <div className="flex justify-center">
                    <div
                      className={[
                        'group relative flex h-20 w-20 cursor-pointer items-center justify-center rounded-2xl border',
                        'transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_8px_32px_rgba(249,115,22,0.18)]',
                        stage.border, stage.bg,
                      ].join(' ')}
                    >
                      <span className="select-none text-2xl sm:text-3xl">{stage.icon}</span>
                      {/* Live metric badge */}
                      <div className={`absolute -right-3 -top-2.5 rounded-full border bg-[#0D0500] px-1.5 py-[3px] ${stage.badgeBorder}`}>
                        <span className={`text-[9px] font-bold leading-none ${stage.metricColor}`}>{stage.metric}</span>
                      </div>
                      {/* Online dot */}
                      <div className="absolute -bottom-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#0D0500]">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                      </div>
                    </div>
                  </div>
                  {/* Animated connector */}
                  {i < productionStages.length - 1 && (
                    <div className="relative mx-2 h-px overflow-hidden rounded-full bg-white/10">
                      <div
                        className="flow-particle w-2/5 bg-gradient-to-r from-transparent via-orange/80 to-transparent"
                        style={{ animationDelay: `${i * -0.32}s` }}
                      />
                    </div>
                  )}
                </Fragment>
              ))}
            </div>

            {/* Stage label row — same grid, labels under each icon */}
            <div
              className="mt-3"
              style={{
                display: 'grid',
                gridTemplateColumns: productionStages.map((_, i) => i === productionStages.length - 1 ? '80px' : '80px 1fr').join(' '),
              }}
            >
              {productionStages.map((stage, i) => (
                <Fragment key={stage.id}>
                  <div className="text-center">
                    <p className="text-[11px] font-semibold leading-tight text-white/70">{stage.label}</p>
                    <p className="text-[9px] text-white/30">{stage.unit}</p>
                  </div>
                  {i < productionStages.length - 1 && <div />}
                </Fragment>
              ))}
            </div>

            {/* Live metrics strip */}
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {liveMetrics.map((m) => (
                <div key={m.label} className="rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-4 text-center backdrop-blur-sm transition-colors hover:border-white/15">
                  <p className="text-[10px] text-white/40">{m.label}</p>
                  <p className={`mt-1.5 text-2xl font-bold ${m.color}`}>{m.value}</p>
                  <p className="mt-0.5 text-[10px] text-white/25">{m.sub}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ═══ TICKER ═══ */}
      <div className="overflow-hidden border-y border-orange/20 bg-[#0D0500] py-4">
        <div className="marquee-inner text-sm font-medium text-orange/70">
          {ticker.map((item, i) => (
            <span key={i} className="flex-shrink-0">{item}<span className="mx-6 text-orange/30">|</span></span>
          ))}
        </div>
      </div>

      {/* ═══ STATS ═══ */}
      <section className="bg-gradient-to-b from-[#0D0500] to-cream py-24 dark:to-darkBg">
        <div className="section-shell">
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
            {statsData.map((s, i) => (
              <div key={s.label} data-animate data-delay={String(i * 100 + 100)} className="rounded-3xl border border-orange/20 bg-white/60 p-8 text-center shadow-soft backdrop-blur-sm dark:bg-darkCard/60">
                <p className="font-display text-5xl font-bold text-orange">
                  <AnimatedCounter end={s.value} suffix={s.suffix} />
                </p>
                <p className="mt-3 text-sm font-medium text-muted dark:text-darkMuted">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PILLARS ═══ */}
      <section className="bg-cream py-24 dark:bg-darkBg">
        <div className="section-shell">
          <div data-animate className="mb-16 text-center">
            <span className="ice-badge mb-4 bg-orange/10 text-orange">Three Core Pillars</span>
            <h2 className="font-display mt-4 text-4xl font-bold text-brown dark:text-darkText lg:text-5xl">Every part of your operation,<br /><span className="grad-text">fully connected</span></h2>
          </div>
          <div className="grid gap-8 lg:grid-cols-3">
            {[
              { icon: '📦', title: 'Procurement & Stores', desc: 'Supplier management, purchase requisitions, POs, GRNs, and quality inspection. Full approval workflow before stock is released.', img: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80', features: ['Supplier Ratings', 'Multi-level Approvals', 'GRN Quality Check', 'Stock Reservation'] },
              { icon: '🏭', title: 'Production & Costing', desc: 'Recipe-driven batch production, shift management, yield tracking, worker productivity, and accurate cost-per-cone calculations.', img: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=600&q=80', features: ['Bill of Materials', 'Batch Costing', 'Wastage Tracking', 'Shift Performance'] },
              { icon: '🏪', title: 'Distribution & Sales', desc: 'Multi-branch stock transfers, branch-level sales, shift close reports, credit control, and customer invoicing.', img: 'https://images.unsplash.com/photo-1576186726115-d2e68cf72477?auto=format&fit=crop&w=600&q=80', features: ['Branch Inventory', 'Credit Limits', 'Shift Close', 'Profitability Report'] },
            ].map((pillar, i) => (
              <div key={pillar.title} data-animate data-delay={String(i * 150 + 100)} className="card-tilt gradient-border group overflow-hidden rounded-3xl border border-border bg-white shadow-soft dark:border-darkBorder dark:bg-darkCard">
                <div className="relative h-48 overflow-hidden">
                  <Image src={pillar.img} alt={pillar.title} fill className="object-cover transition-transform duration-700 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-3">
                    <span className="text-3xl">{pillar.icon}</span>
                    <h3 className="font-display text-xl font-bold text-white">{pillar.title}</h3>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-sm leading-relaxed text-muted dark:text-darkMuted">{pillar.desc}</p>
                  <ul className="mt-5 space-y-2">
                    {pillar.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm font-medium text-brown dark:text-darkText">
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-orange" />{f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ MODULES ═══ */}
      <section id="modules" className="bg-[#0D0500] py-24">
        <div className="section-shell">
          <div data-animate className="mb-16 text-center">
            <span className="ice-badge mb-4 bg-orange/10 text-orange">12 Integrated Modules</span>
            <h2 className="font-display mt-4 text-4xl font-bold text-white lg:text-5xl">One platform for every<br /><span className="grad-text">department and role</span></h2>
            <p className="mt-4 text-white/50">From factory floor to finance desk — every workflow built in</p>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {modules.map((mod, i) => {
              const Icon = mod.icon;
              return (
                <div key={mod.label} data-animate data-delay={String((i % 4) * 100 + 100)} className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/5 p-5 transition-all duration-300 hover:border-white/20 hover:bg-white/10">
                  <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${mod.color} text-white`}><Icon className="h-5 w-5" /></div>
                  <h3 className="font-semibold text-white">{mod.label}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">{mod.desc}</p>
                  <div className={`absolute bottom-0 left-0 h-0.5 w-0 bg-gradient-to-r ${mod.color} transition-all duration-500 group-hover:w-full`} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="how-it-works" className="bg-cream py-24 dark:bg-darkBg">
        <div className="section-shell">
          <div data-animate className="mb-16 text-center">
            <span className="ice-badge mb-4 bg-orange/10 text-orange">End-to-End Workflow</span>
            <h2 className="font-display mt-4 text-4xl font-bold text-brown dark:text-darkText lg:text-5xl">From supplier to sale —<br /><span className="grad-text">completely automated</span></h2>
          </div>
          <div className="relative">
            <div className="absolute left-8 top-8 hidden h-[calc(100%-4rem)] w-px bg-gradient-to-b from-orange via-amber-400 to-transparent lg:block" />
            <div className="space-y-6">
              {workflow.map((step, i) => (
                <div key={step.step} data-animate data-delay={String(i * 100 + 100)} className="group flex gap-6">
                  <div className="relative z-10 flex-shrink-0">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-orange/30 bg-orange/10 text-2xl transition-all duration-300 group-hover:border-orange group-hover:bg-orange">{step.icon}</div>
                    <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange text-[10px] font-bold text-white">{step.step}</span>
                  </div>
                  <div className="flex-1 rounded-2xl border border-border bg-white p-5 shadow-soft transition-all duration-300 group-hover:border-orange/30 group-hover:shadow-card-hover dark:border-darkBorder dark:bg-darkCard">
                    <h3 className="font-display font-bold text-brown dark:text-darkText">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted dark:text-darkMuted">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ ROLE-BASED ACCESS ═══ */}
      <section className="bg-[#0D0500] py-24">
        <div className="section-shell">
          <div data-animate className="mb-16 text-center">
            <span className="ice-badge mb-4 bg-orange/10 text-orange">Security & Access Control</span>
            <h2 className="font-display mt-4 text-4xl font-bold text-white lg:text-5xl">Every employee sees<br /><span className="grad-text">only what they need</span></h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {roles.map((r, i) => (
              <div key={r.role} data-animate data-delay={String((i % 3) * 100 + 100)} className={`rounded-2xl border p-5 ${r.color}`}>
                <div className="mb-3 flex items-center gap-2"><Lock className="h-4 w-4" /><span className="font-display font-semibold">{r.role}</span></div>
                <ul className="space-y-1.5">{r.perms.map((p) => (<li key={p} className="flex items-center gap-2 text-xs"><span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />{p}</li>))}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ APPROVAL WORKFLOW ═══ */}
      <section className="bg-cream py-24 dark:bg-darkBg">
        <div className="section-shell">
          <div data-animate className="mb-16 text-center">
            <span className="ice-badge mb-4 bg-orange/10 text-orange">Governance Framework</span>
            <h2 className="font-display mt-4 text-4xl font-bold text-brown dark:text-darkText lg:text-5xl">4-Level approval<br /><span className="grad-text">for every major transaction</span></h2>
            <p className="mt-4 text-muted dark:text-darkMuted">Purchases, stock adjustments, credit sales, payments, and budget amendments all flow through structured approval chains.</p>
          </div>
          <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
            {approvalLevels.map((level, i) => (
              <div key={level.level} data-animate="scale" data-delay={String(i * 120 + 100)} className="flex-1 overflow-hidden rounded-2xl border border-border bg-white shadow-soft dark:border-darkBorder dark:bg-darkCard">
                <div className={`${level.color} px-5 py-3`}>
                  <span className="text-xs font-bold uppercase tracking-widest text-white/80">Level {level.level}</span>
                  <p className="font-display font-bold text-white">{level.title}</p>
                </div>
                <div className="p-5"><p className="text-sm text-muted dark:text-darkMuted">{level.trigger}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ KEY CAPABILITIES ═══ */}
      <section id="features" className="bg-[#0D0500] py-24">
        <div className="section-shell">
          <div data-animate className="mb-16 text-center">
            <span className="ice-badge mb-4 bg-orange/10 text-orange">Finance & Control</span>
            <h2 className="font-display mt-4 text-4xl font-bold text-white lg:text-5xl">Built for the Finance Manager,<br /><span className="grad-text">Auditor & MD</span></h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: '📊', title: 'Full Financial Statements', desc: 'Income Statement, Balance Sheet, Cash Flow Statement, and Trial Balance generated automatically.', delay: '100' },
              { icon: '💵', title: 'Cost Per Cone', desc: 'Direct materials, labour, overhead allocated per batch and per unit. Track every cent in production.', delay: '200' },
              { icon: '🏦', title: 'Bank & Cash Control', desc: 'Daily cash counts, petty cash requests, bank reconciliations, and payment approvals.', delay: '300' },
              { icon: '📋', title: 'Audit Trail', desc: 'Every action logged — who created, who approved, when, and what changed. No deletion without trace.', delay: '400' },
              { icon: '📈', title: 'Budget vs Actual', desc: 'Each department prepares budgets. System compares budget vs actual with variance alerts.', delay: '500' },
              { icon: '🔗', title: 'Excel Import/Export', desc: 'Import master data and export all reports to Excel. Full Supabase real-time database underneath.', delay: '600' },
            ].map((feat) => (
              <div key={feat.title} data-animate data-delay={feat.delay} className="group rounded-2xl border border-white/8 bg-white/5 p-6 transition-all duration-300 hover:border-orange/30 hover:bg-white/10">
                <div className="mb-4 text-4xl">{feat.icon}</div>
                <h3 className="font-display font-bold text-white">{feat.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ PRODUCTION COSTING VISUAL ═══ */}
      <section className="bg-cream py-24 dark:bg-darkBg">
        <div className="section-shell">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div data-animate>
                <span className="ice-badge mb-4 bg-orange/10 text-orange">Production Costing</span>
                <h2 className="font-display mt-4 text-4xl font-bold text-brown dark:text-darkText lg:text-5xl">Know your cost<br /><span className="grad-text">per cone, per batch</span></h2>
                <p className="mt-6 text-muted dark:text-darkMuted">The system tracks three chocolate types, ice cream mix, and all packaging materials. Standard vs actual usage variances calculated automatically for every batch.</p>
              </div>
              <div className="mt-8 space-y-3">
                {[{ label: 'Raw Materials', value: '62%', color: 'bg-orange' }, { label: 'Packaging', value: '18%', color: 'bg-amber-400' }, { label: 'Direct Labour', value: '12%', color: 'bg-blue-500' }, { label: 'Overhead', value: '8%', color: 'bg-violet-500' }].map((item, i) => (
                  <div key={item.label} data-animate data-delay={String(i * 100 + 200)}>
                    <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-brown dark:text-darkText">{item.label}</span><span className="text-muted dark:text-darkMuted">{item.value}</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-border dark:bg-darkBorder"><div className={`h-full rounded-full ${item.color}`} style={{ width: item.value }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div data-animate="right" className="relative">
              <div className="overflow-hidden rounded-3xl border border-border shadow-soft dark:border-darkBorder">
                <Image src="https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=700&q=80" alt="Ice cream production" width={700} height={500} className="w-full object-cover" />
              </div>
              <div className="glass-dark absolute -bottom-4 -left-4 rounded-2xl p-4 text-white shadow-lg">
                <p className="text-xs text-white/60">Cost per Cone</p>
                <p className="font-display text-3xl font-bold text-orange">$0.47</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-emerald-400"><Zap className="h-3 w-3" />3.2% under budget</p>
              </div>
              <div className="glass-dark absolute -right-4 -top-4 rounded-2xl p-4 text-white shadow-lg">
                <p className="text-xs text-white/60">Today&apos;s Batches</p>
                <p className="font-display text-3xl font-bold text-white">6</p>
                <p className="mt-1 text-xs text-white/50">2 pending QC</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ REPORTS ═══ */}
      <section className="bg-[#0D0500] py-24">
        <div className="section-shell">
          <div data-animate className="mb-16 text-center">
            <span className="ice-badge mb-4 bg-orange/10 text-orange">Business Intelligence</span>
            <h2 className="font-display mt-4 text-4xl font-bold text-white lg:text-5xl">Reports that actually<br /><span className="grad-text">drive decisions</span></h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { emoji: '🏭', title: 'Daily Production', desc: 'Output by shift, product line, and operator', tag: 'Production' },
              { emoji: '🏪', title: 'Branch Sales', desc: 'Daily branch turnover, payments, and variances', tag: 'Sales' },
              { emoji: '📦', title: 'Material Usage', desc: 'Ingredient consumption vs planned production', tag: 'Inventory' },
              { emoji: '⚠️', title: 'Wastage Report', desc: 'Yield loss, causes, and corrective trends', tag: 'Quality' },
              { emoji: '💰', title: 'Income Statement', desc: 'Revenue, COGS, gross and net profit daily', tag: 'Finance' },
              { emoji: '🏦', title: 'Stock Valuation', desc: 'Current on-hand value across all warehouses', tag: 'Inventory' },
              { emoji: '📈', title: 'Budget Variance', desc: 'Budget vs actual with department breakdown', tag: 'Finance' },
              { emoji: '👷', title: 'Productivity', desc: 'Cones per worker per shift with efficiency score', tag: 'HR' },
            ].map((r, i) => (
              <div key={r.title} data-animate data-delay={String((i % 4) * 100 + 100)} className="group rounded-2xl border border-white/8 bg-white/5 p-5 transition-all duration-300 hover:border-orange/30 hover:bg-white/8">
                <div className="mb-3 flex items-start justify-between">
                  <span className="text-3xl">{r.emoji}</span>
                  <span className="ice-badge bg-white/10 text-white/50 text-[10px]">{r.tag}</span>
                </div>
                <h3 className="font-semibold text-white">{r.title}</h3>
                <p className="mt-1 text-xs text-white/40">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="bg-cream py-24 dark:bg-darkBg">
        <div className="section-shell">
          <div data-animate className="mb-12 text-center">
            <span className="ice-badge mb-4 bg-orange/10 text-orange">FAQ</span>
            <h2 className="font-display mt-4 text-3xl font-bold text-brown dark:text-darkText lg:text-4xl">Common questions</h2>
          </div>
          <FaqSection />
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative overflow-hidden bg-[#0D0500] py-32">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-0 h-[400px] w-[400px] rounded-full bg-orange/20 blur-[100px]" />
          <div className="absolute right-1/4 bottom-0 h-[300px] w-[300px] rounded-full bg-amber-500/15 blur-[80px]" />
        </div>
        <div className="section-shell relative z-10 text-center">
          <div data-animate>
            <Star className="mx-auto mb-6 h-10 w-10 text-orange" />
            <h2 className="font-display text-5xl font-bold text-white lg:text-6xl">Ready to run the factory<br /><span className="grad-text">at full visibility?</span></h2>
            <p className="mx-auto mt-6 max-w-xl text-lg text-white/50">Log in and start managing your ice cream manufacturing operation with complete control.</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/auth/login" className="btn-shimmer group inline-flex items-center gap-2 rounded-2xl bg-orange px-10 py-4 text-lg font-semibold text-white shadow-[0_0_40px_rgba(249,115,22,0.5)] transition-all duration-300 hover:bg-deepOrange hover:shadow-[0_0_60px_rgba(249,115,22,0.7)]">
                Launch Dashboard<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-white/8 bg-[#0D0500] py-12">
        <div className="section-shell flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange text-white text-sm font-bold">A</div>
            <div>
              <p className="font-semibold text-white">Absolute Ice Cream ERP</p>
              <p className="text-xs text-white/40">Manufacturing Intelligence Platform</p>
            </div>
          </div>
          <p className="text-sm text-white/30">© {new Date().getFullYear()} Absolute Quality Icecream. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
