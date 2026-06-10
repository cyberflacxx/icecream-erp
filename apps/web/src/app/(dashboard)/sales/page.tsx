'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  FileText,
  Package,
  Plus,
  ShoppingCart,
  TrendingUp,
  Users
} from 'lucide-react';
import { PageHeader } from '@/components/dashboard/page-header';

const salesStats = [
  { label: "Today's Revenue", value: '$4,280', change: '+8.4%', up: true, icon: TrendingUp, color: 'text-orange border-orange/20 bg-orange/10' },
  { label: 'Open Orders', value: '14', change: '3 pending delivery', up: null, icon: ShoppingCart, color: 'text-blue-400 border-blue-400/20 bg-blue-400/10' },
  { label: 'Customers', value: '128', change: '+3 this week', up: true, icon: Users, color: 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10' },
  { label: 'Outstanding', value: '$12,450', change: '8 overdue invoices', up: false, icon: FileText, color: 'text-red-400 border-red-400/20 bg-red-400/10' },
];

const recentOrders = [
  { id: 'SO-0021', customer: 'Eastgate Supermart', items: 4, total: '$860', status: 'INVOICED', date: 'Today' },
  { id: 'SO-0020', customer: 'Sunshine Café', items: 2, total: '$240', status: 'DELIVERED', date: 'Today' },
  { id: 'SO-0019', customer: 'Borrowdale Fresh', items: 6, total: '$1,420', status: 'PICKING', date: 'Yesterday' },
  { id: 'SO-0018', customer: 'Avondale School', items: 3, total: '$390', status: 'PAID', date: 'Yesterday' },
  { id: 'SO-0017', customer: 'Harare Hotels Ltd', items: 8, total: '$2,100', status: 'CONFIRMED', date: '2 days ago' },
];

const statusColors: Record<string, string> = {
  DRAFT: 'bg-white/10 text-white/50',
  CONFIRMED: 'bg-blue-500/15 text-blue-400',
  PICKING: 'bg-amber-500/15 text-amber-400',
  DELIVERED: 'bg-emerald-500/15 text-emerald-400',
  INVOICED: 'bg-violet-500/15 text-violet-400',
  PAID: 'bg-green-500/15 text-green-400',
  CANCELLED: 'bg-red-500/15 text-red-400',
};

const quickLinks = [
  { href: '/sales/orders', icon: ShoppingCart, label: 'Sales Orders', desc: 'Create and manage customer orders' },
  { href: '/sales/customers', icon: Users, label: 'Customers', desc: 'Customer accounts and credit limits' },
  { href: '/sales/invoices', icon: FileText, label: 'Invoices', desc: 'Billing and payment tracking' },
];

export default function SalesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Sales Management"
        description="Customer orders, invoicing, credit control, and branch sales visibility."
        status="partial"
        actions={
          <Link
            href="/sales/orders/new"
            className="inline-flex items-center gap-2 rounded-xl bg-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-deepOrange"
          >
            <Plus className="h-4 w-4" />
            New Order
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {salesStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`rounded-2xl border p-5 ${stat.color}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-white/50">{stat.label}</p>
                  <p className="mt-1.5 font-display text-2xl font-bold text-white">{stat.value}</p>
                  <p className={`mt-1 text-xs ${stat.up === true ? 'text-emerald-400' : stat.up === false ? 'text-red-400' : 'text-white/40'}`}>
                    {stat.change}
                  </p>
                </div>
                <div className="rounded-xl border border-current/20 bg-current/10 p-2">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-3">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="group flex items-center justify-between rounded-2xl border border-white/8 bg-white/5 p-5 transition-all hover:border-orange/30 hover:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange/15 text-orange">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-white">{link.label}</p>
                  <p className="text-xs text-white/40">{link.desc}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-white/30 transition-transform group-hover:translate-x-1 group-hover:text-orange" />
            </Link>
          );
        })}
      </div>

      {/* Recent orders */}
      <div className="rounded-2xl border border-white/8 bg-white/5">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h3 className="font-display font-semibold text-white">Recent Sales Orders</h3>
          <Link href="/sales/orders" className="text-xs text-orange hover:underline">View all</Link>
        </div>
        <div className="divide-y divide-white/5">
          {recentOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between px-5 py-4 transition hover:bg-white/5">
              <div className="flex items-center gap-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange/10 text-orange">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-semibold text-white">{order.id}</p>
                  <p className="text-xs text-white/40">{order.customer} · {order.items} items</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusColors[order.status] ?? 'bg-white/10 text-white/50'}`}>
                  {order.status}
                </span>
                <p className="text-sm font-semibold text-white">{order.total}</p>
                <p className="hidden text-xs text-white/30 sm:block">{order.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Credit control notice */}
      <div className="flex items-start gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-5">
        <BadgeCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
        <div>
          <p className="font-semibold text-amber-300">Credit Control Active</p>
          <p className="mt-1 text-sm text-amber-400/70">
            Sales above customer credit limits require Finance Manager approval (Level 3) before dispatch. Transactions cannot be edited after posting without authorization.
          </p>
        </div>
      </div>
    </div>
  );
}
