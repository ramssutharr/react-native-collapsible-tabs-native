import { defineConfig } from 'vitepress';

const repo = 'https://github.com/ramssutharr/react-native-collapsible-tabs-native';

export default defineConfig({
  title: 'Collapsible Tabs',
  titleTemplate: ':title · react-native-collapsible-tabs-native',
  description:
    'Native collapsible tabs for React Native: a collapsing header and pinned tab bar over a native pager, frame-synced with the list. iOS + Android, Fabric.',
  base: '/react-native-collapsible-tabs-native/',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,
  head: [
    ['meta', { name: 'theme-color', content: '#3d6bdb' }],
    ['meta', { property: 'og:title', content: 'react-native-collapsible-tabs-native' }],
    [
      'meta',
      {
        property: 'og:description',
        content:
          'Collapsing header + pinned tab bar over a native pager, in the same frame as the list. No per-frame JS.',
      },
    ],
    ['link', { rel: 'icon', href: '/react-native-collapsible-tabs-native/favicon.svg', type: 'image/svg+xml' }],
  ],
  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: 'Collapsible Tabs',
    nav: [
      { text: 'Guide', link: '/guide/', activeMatch: '/guide/' },
      { text: 'API', link: '/api/collapsible-tab-view', activeMatch: '/api/' },
      { text: 'Benchmarks', link: '/benchmarks' },
      { text: 'Changelog', link: '/changelog' },
      { text: 'npm', link: 'https://www.npmjs.com/package/react-native-collapsible-tabs-native' },
    ],
    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Introduction', link: '/guide/' },
            { text: 'Getting started', link: '/guide/getting-started' },
            { text: 'Usage', link: '/guide/usage' },
            { text: 'Per-frame events', link: '/guide/events' },
            { text: 'Recipes', link: '/guide/recipes' },
            { text: 'How it works', link: '/guide/how-it-works' },
            { text: 'What it does not do', link: '/guide/limitations' },
            { text: 'FAQ', link: '/guide/faq' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API',
          items: [
            { text: 'CollapsibleTabView', link: '/api/collapsible-tab-view' },
            { text: 'ref', link: '/api/ref' },
            { text: 'TabBar', link: '/api/tab-bar' },
            { text: 'createTabList', link: '/api/create-tab-list' },
            { text: 'CollapsibleTabsShell', link: '/api/shell' },
          ],
        },
      ],
    },
    socialLinks: [{ icon: 'github', link: repo }],
    editLink: {
      pattern: `${repo}/edit/main/website/:path`,
      text: 'Edit this page on GitHub',
    },
    search: { provider: 'local' },
    outline: { level: [2, 3] },
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2026 Ram Suthar',
    },
  },
});
