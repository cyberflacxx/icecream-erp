import Image from 'next/image';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Factory,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  UsersRound,
  Wallet,
  Warehouse,
  Workflow
} from 'lucide-react';

import { FaqSection } from '@/components/landing/faq';
import { Navbar } from '@/components/landing/navbar';
import { Button } from '@/components/ui/button';

interface CardItem {
  title: string;
  description: string;
  icon: LucideIcon;
}

const stats = ['9 User Roles', '10 ERP Modules', 'Real-Time Stock', 'Multi-Branch'];

const pillars: CardItem[] = [
  {
    title: 'Procurement',
    description: 'From supplier to warehouse with full audit trail and approval workflow',
    icon: ClipboardCheck
  },
  {
    title: 'Production',
    description: 'Recipe-driven batch production with wastage tracking and quality checks',
    icon: Factory
  },
  {
    title: 'Distribution',
    description: 'Branch stock control, shift close reports, and real-time sales recording',
    icon: Truck
  }
];

const modules: CardItem[] = [
  { title: 'Dashboard', description: 'Executive visibility across factory, stock, and branches.', icon: LayoutDashboard },
  { title: 'Procurement', description: 'Raise requests, approvals, purchase orders, and supplier tracking.', icon: Truck },
  { title: 'Inventory', description: 'Monitor raw materials, finished goods, transfers, and counts.', icon: Package },
  { title: 'Production', description: 'Coordinate shifts, batches, recipes, and yield performance.', icon: Factory },
  { title: 'Branch Operations', description: 'Manage branch warehouses, shifts, and operational controls.', icon: Building2 },
  { title: 'Sales', description: 'Capture branch sales, payment summaries, and sales trends.', icon: ShoppingCart },
  { title: 'Finance', description: 'Post operational entries, margins, reconciliations, and summaries.', icon: Wallet },
  { title: 'HR & Payroll', description: 'Organize roles, staffing structures, and payroll-ready records.', icon: UsersRound },
  { title: 'Reports', description: 'Generate management-ready visibility across every department.', icon: BarChart3 },
  { title: 'Settings', description: 'Configure roles, permissions, company data, and master tables.', icon: Settings }
];

const steps = [
  'Supplier delivers raw materials',
  'Stock received and quality checked',
  'Production batch created from recipe',
  'Raw materials consumed, finished goods produced',
  'Stock transferred to branches',
  'Branch records sales and closes shift',
  'Reports and finance entries generated'
];

const reports: CardItem[] = [
  { title: 'Daily Production Report', description: 'Output by shift, product line, and operator.', icon: Factory },
  { title: 'Branch Sales Report', description: 'Daily branch turnover, payments, and variances.', icon: Receipt },
  { title: 'Raw Material Usage', description: 'Ingredient consumption against planned production.', icon: Boxes },
  { title: 'Wastage Report', description: 'Track yield loss, causes, and corrective action trends.', icon: CircleAlert },
  { title: 'Inventory Valuation', description: 'See what is on hand and the value tied to it.', icon: Warehouse },
  { title: 'Low Stock Alerts', description: 'Identify shortages before production or branches stall.', icon: FileText }
];

const branchBullets = [
  'Branch-level stock control',
  'Shift close with variance detection',
  'Real-time sales updates',
  'Branch profit and loss'
];

export default function HomePage() {
  return (
    <main className="relative">
      <Navbar />

      <section className="relative overflow-hidden bg-cream">
        <div className="absolute inset-0 -z-20 bg-[url('/branding/hero-bg.png')] bg-cover bg-center opacity-45" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-cream/72 via-cream/80 to-cream/92" />
        <div className="section-shell relative py-24 sm:py-28">
          <div className="absolute inset-x-0 top-8 -z-10 mx-auto h-72 max-w-4xl rounded-full bg-orange/10 blur-3xl" />
          <div className="absolute right-0 top-10 -z-10 h-64 w-64 rounded-full bg-white/60 blur-3xl" />

          <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
            <span className="rounded-full border border-orange/20 bg-white/80 px-4 py-2 text-sm font-semibold text-orange shadow-sm">
              Manufacturing ERP for Zimbabwe&apos;s Ice Cream Industry
            </span>

            <h1 className="mt-8 text-4xl font-bold tracking-tight text-brown sm:text-5xl lg:text-7xl">
              From Raw Ingredients to Branch Sales
              <span className="block text-deepOrange">One System</span>
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
              Track procurement, production shifts, finished goods, branch stock, and sales in
              real time. Built for ice cream manufacturers.
            </p>

            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/auth/login" prefetch={false}>
                  Login to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#modules">Explore Modules</a>
              </Button>
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-5xl gap-4 rounded-[28px] border border-border bg-white p-6 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat}
                className="rounded-2xl border border-cream bg-cream/60 px-5 py-5 text-center text-sm font-semibold text-brown"
              >
                {stat}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="bg-white py-24">
        <div className="section-shell">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-orange">
              Why It Matters
            </span>
            <h2 className="mt-4 text-3xl font-semibold text-brown sm:text-4xl">Three Core Pillars</h2>
            <p className="mt-4 text-base leading-7 text-muted">
              The platform is structured around the operational flow of an ice cream factory,
              keeping procurement, production, and distribution tightly connected.
            </p>
          </div>

          <div className="mt-14 grid gap-6 lg:grid-cols-3">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;

              return (
                <article
                  key={pillar.title}
                  className="rounded-2xl border border-border bg-cream/70 p-8 shadow-sm transition-transform hover:-translate-y-1"
                >
                  <div className="inline-flex rounded-2xl bg-white p-4 text-orange shadow-sm">
                    <Icon className="h-7 w-7" />
                  </div>
                  <h3 className="mt-6 text-2xl font-semibold text-brown">{pillar.title}</h3>
                  <p className="mt-4 text-base leading-7 text-muted">{pillar.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="modules" className="bg-cream py-24">
        <div className="section-shell">
          <div className="max-w-3xl">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-orange">
              Modules
            </span>
            <h2 className="mt-4 text-3xl font-semibold text-brown sm:text-4xl">
              Everything You Need to Run Your Factory
            </h2>
            <p className="mt-4 text-base leading-7 text-muted">
              A connected operating system for procurement, manufacturing, branch execution, and
              management reporting.
            </p>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-5">
            {modules.map((module) => {
              const Icon = module.icon;

              return (
                <article key={module.title} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cream text-orange">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-brown">{module.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{module.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white py-24">
        <div className="section-shell">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-orange">
              Process Flow
            </span>
            <h2 className="mt-4 text-3xl font-semibold text-brown sm:text-4xl">How It Works</h2>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-border bg-cream/70 p-6 shadow-sm">
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <Workflow className="h-5 w-5 text-orange" />
                </div>
                <p className="mt-5 text-base leading-7 text-brown">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-cream py-24">
        <div className="section-shell grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-orange">
              Branch Visibility
            </span>
            <h2 className="mt-4 text-3xl font-semibold text-brown sm:text-4xl">
              Multi-Branch, One Dashboard
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Each branch has its own warehouse, stock balances, sales records, and shift close
              workflow. Central management sees everything.
            </p>

            <div className="mt-8 space-y-4">
              {branchBullets.map((bullet) => (
                <div key={bullet} className="flex items-center gap-3 text-base font-medium text-brown">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-border bg-white p-6 shadow-soft">
            <div className="rounded-2xl bg-brown p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-white/70">Central Overview</p>
                  <h3 className="mt-3 text-2xl font-semibold">Branch Control Panel</h3>
                </div>
                <Building2 className="h-10 w-10 text-vanilla" />
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-white/70">Active Branches</p>
                  <p className="mt-2 text-3xl font-semibold">4</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-white/70">Live Sales Feed</p>
                  <p className="mt-2 text-3xl font-semibold">24/7</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-white/70">Shift Variances</p>
                  <p className="mt-2 text-3xl font-semibold">Flagged</p>
                </div>
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-sm text-white/70">Stock Transfers</p>
                  <p className="mt-2 text-3xl font-semibold">Tracked</p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl bg-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Store className="h-5 w-5 text-vanilla" />
                    <span className="font-medium">Borrowdale Branch</span>
                  </div>
                  <span className="rounded-full bg-success/20 px-3 py-1 text-xs font-semibold text-[#c7f9d7]">
                    Shift balanced
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white py-24">
        <div className="section-shell">
          <div className="mx-auto max-w-3xl text-center">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-orange">
              Decision Support
            </span>
            <h2 className="mt-4 text-3xl font-semibold text-brown sm:text-4xl">
              Reports That Drive Decisions
            </h2>
          </div>

          <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {reports.map((report) => {
              const Icon = report.icon;

              return (
                <article key={report.title} className="rounded-2xl border border-border bg-cream/70 p-6 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-orange shadow-sm">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-brown">{report.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted">{report.description}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section id="faq" className="bg-cream py-24">
        <div className="section-shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-orange">
              FAQ
            </span>
            <h2 className="mt-4 text-3xl font-semibold text-brown sm:text-4xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 max-w-lg text-base leading-7 text-muted">
              Straight answers for manufacturers planning a single source of truth across factory,
              warehouse, and branch operations.
            </p>
          </div>
          <FaqSection />
        </div>
      </section>

      <footer className="border-t border-brown/10 bg-brown py-12 text-white">
        <div className="section-shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="relative inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white">
                <Image
                  src="/branding/logo.png"
                  alt="Absolute Ice Cream ERP Logo"
                  fill
                  sizes="40px"
                  className="object-cover"
                />
              </span>
              <div>
                <p className="font-semibold">Absolute Ice Cream ERP</p>
                <p className="text-sm text-white/70">Built for Absolute Quality Icecream</p>
              </div>
            </div>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/70">
              A modern ERP foundation for procurement, manufacturing, branch stock control, sales,
              and reporting.
            </p>
          </div>

          <div className="flex flex-col gap-4 text-sm text-white/80 sm:flex-row sm:items-center sm:gap-8">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#modules" className="transition hover:text-white">
              Modules
            </a>
            <a href="#faq" className="transition hover:text-white">
              FAQ
            </a>
          </div>
        </div>

        <div className="section-shell mt-8 border-t border-white/10 pt-6 text-sm text-white/60">
          © 2026 Absolute Quality Icecream. All rights reserved.
        </div>
      </footer>
    </main>
  );
}
