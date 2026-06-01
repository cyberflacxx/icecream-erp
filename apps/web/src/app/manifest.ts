import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Absolute Ice Cream ERP',
    short_name: 'IceCream ERP',
    description:
      "Manufacturing ERP for Zimbabwe's ice cream industry, from procurement to production, branches, and sales.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fff7e8',
    theme_color: '#f97316',
    icons: [
      {
        src: '/branding/icon-192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/branding/icon-512.png',
        sizes: '512x512',
        type: 'image/png'
      },
      {
        src: '/branding/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  };
}
