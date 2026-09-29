import { defineConfig } from 'vitepress';

const repo = 'https://github.com/ramssutharr/react-native-collapsible-tabs-native';
const site = 'https://ramssutharr.github.io/react-native-collapsible-tabs-native/';

export default defineConfig({
  title: 'Collapsible Tabs',
  titleTemplate: ':title · react-native-collapsible-tabs-native',
  description:
    'Native collapsible tabs for React Native: a collapsing header and pinned tab bar over a native pager, frame-synced with the list. iOS + Android, Fabric.',
  base: '/react-native-collapsible-tabs-native/',
  lang: 'en-US',
  lastUpdated: true,
  cleanUrls: true,
  sitemap: { hostname: 'https://ramssutharr.github.io/react-native-collapsible-tabs-native/' },
  head: [
    ['meta', { name: 'theme-color', content: '#3d6bdb' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'react-native-collapsible-tabs-native' }],
    ['link', { rel: 'icon', href: '/react-native-collapsible-tabs-native/favicon.svg', type: 'image/svg+xml' }],
  ],
  // Per-page canonical URL and Open Graph title/description, from the page's
  // own frontmatter, so every page tells crawlers which URL is the real one
  // and shares with its own summary rather than the site-wide one.
  transformPageData(pageData) {
    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '');
    const url = `${site}${path}`;
    const title = pageData.frontmatter.title || pageData.title || 'react-native-collapsible-tabs-native';
    const description = pageData.frontmatter.description || pageData.description;
    pageData.frontmatter.head ??= [];
    pageData.frontmatter.head.push(
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { name: 'twitter:card', content: 'summary' }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
    );
  },
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
            { text: 'Collapsible header', link: '/guide/collapsible-header' },
            { text: 'With FlashList', link: '/guide/flashlist' },
            { text: 'Per-frame events', link: '/guide/events' },
            { text: 'Recipes', link: '/guide/recipes' },
            { text: 'How it works', link: '/guide/how-it-works' },
            { text: 'Alternatives', link: '/guide/alternatives' },
            { text: 'Limitations & compatibility', link: '/guide/limitations' },
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
