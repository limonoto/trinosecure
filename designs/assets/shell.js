/* Trino-Secure shell: builds sidebar + topbar around per-page content,
   handles theme/env persistence, and exposes UI helpers (drawer, modal,
   toast, confirm, dragOrder, icon). Include AFTER the page's #page template. */
(function () {
  'use strict';

  /* ---------------- icons (lucide-style, 24x24 stroke) ---------------- */
  const P = {
    dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
    diff: '<circle cx="5" cy="6" r="3"/><path d="M5 9v6"/><circle cx="5" cy="18" r="3"/><path d="M12 3h3a2 2 0 0 1 2 2v10"/><path d="m15 6-3-3 3-3" transform="translate(0 6)"/><path d="M19 15v6"/><path d="M16 18h6"/>',
    history: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    mapping: '<path d="M18 8a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2"/><path d="M6 8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2"/><path d="M2 12h2"/><path d="M20 12h2"/><circle cx="18" cy="12" r="0"/><path d="M9 12h6"/>',
    key: '<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L21 5"/><path d="m21 2-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
    userpass: '<circle cx="12" cy="8" r="4"/><path d="M6 21v-1a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v1"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    cert: '<path d="M15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6"/><path d="M9 7h6"/><path d="M9 11h4"/><circle cx="17" cy="15" r="3"/><path d="m15.5 17.5-1 3.5 2.5-1.5 2.5 1.5-1-3.5"/>',
    secret: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/><path d="m3 3 18 18" stroke-width="2"/>',
    backend: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    audit: '<path d="M15 3v4a2 2 0 0 0 2 2h4"/><path d="M5 8V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2H7"/><path d="M3 15h6"/><path d="M3 18h6"/><path d="M3 12h4"/>',
    tree: '<rect x="14" y="3" width="7" height="6" rx="1"/><rect x="14" y="15" width="7" height="6" rx="1"/><path d="M4 4v14a2 2 0 0 0 2 2h8"/><path d="M14 6H4"/>',
    server: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><path d="M6 6h.01"/><path d="M6 18h.01"/>',
    settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.555C21.965 6.012 17.461 2 12 2z"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    chevronr: '<path d="m9 18 6-6-6-6"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    checkcircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    drift: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/>',
    rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    edit: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    dots: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    play: '<path d="M5 3l14 9-14 9z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
    layers: '<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  };
  function icon(name, cls) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="' + (cls || '') + '" aria-hidden="true">' + (P[name] || '') + '</svg>';
  }

  /* ---------------- navigation model ---------------- */
  const NAV = [
    { group: 'Overview', items: [{ id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'dashboard' }] },
    { group: 'Authorization', items: [
      { id: 'rules', label: 'Rules Workspace', href: 'rules-workspace.html', icon: 'shield' },
      { id: 'import', label: 'Import & Diff', href: 'import-diff.html', icon: 'diff' },
      { id: 'history', label: 'Version History', href: 'version-history.html', icon: 'history' },
    ]},
    { group: 'Identity', items: [
      { id: 'groups', label: 'Groups', href: 'groups.html', icon: 'users' },
      { id: 'mapping', label: 'User & Group Mapping', href: 'mapping.html', icon: 'mapping' },
    ]},
    { group: 'Authentication', items: [
      { id: 'auth', label: 'Auth Methods', href: 'auth-methods.html', icon: 'key' },
      { id: 'pwusers', label: 'Password File Users', href: 'password-users.html', icon: 'userpass' },
    ]},
    { group: 'Cluster Security', items: [
      { id: 'tls', label: 'TLS / HTTPS', href: 'tls.html', icon: 'lock' },
      { id: 'certs', label: 'Certificates', href: 'certificates.html', icon: 'cert' },
      { id: 'secrets', label: 'Secrets', href: 'secrets.html', icon: 'secret' },
    ]},
    { group: 'Access Control', items: [
      { id: 'backend', label: 'Backend Selector', href: 'backend-selector.html', icon: 'backend' },
    ]},
    { group: 'Audit & Insight', items: [
      { id: 'audit', label: 'Audit Log', href: 'audit-log.html', icon: 'audit' },
      { id: 'effective', label: 'Effective Permissions', href: 'effective-permissions.html', icon: 'tree' },
    ]},
    { group: 'Settings', items: [
      { id: 'envs', label: 'Environments', href: 'environments.html', icon: 'server' },
      { id: 'settings', label: 'App Settings', href: 'settings.html', icon: 'settings' },
    ]},
  ];

  const ENVS = [
    { id: 'prod', name: 'Production', sub: 'trino.prod.internal', tone: 'destructive' },
    { id: 'staging', name: 'Staging', sub: 'trino.stg.internal', tone: 'warning' },
    { id: 'dev', name: 'Development', sub: 'trino.dev.internal', tone: 'info' },
  ];

  // Icon shown on the rail for each top-level section.
  const GROUP_ICONS = {
    'Overview': 'dashboard', 'Authorization': 'shield', 'Identity': 'users',
    'Authentication': 'key', 'Cluster Security': 'lock', 'Access Control': 'backend',
    'Audit & Insight': 'audit', 'Settings': 'settings',
  };

  /* ---------------- state: a tiny observable store ----------------
     createStore(initial) → { get, set, subscribe }. This is the single
     source of truth for cross-cutting UI state (theme, environment).
     Pages and chrome subscribe; calling set() patches state, persists
     it, and notifies every subscriber. Port target: a React context +
     useSyncExternalStore, or a Zustand store with the same shape. */
  function createStore(initial) {
    var state = Object.assign({}, initial);
    var subs = [];
    return {
      get: function (k) { return k ? state[k] : Object.assign({}, state); },
      set: function (patch) { Object.assign(state, patch); subs.forEach(function (fn) { fn(state); }); },
      subscribe: function (fn) { subs.push(fn); return function () { subs = subs.filter(function (s) { return s !== fn; }); }; },
    };
  }
  const Store = createStore({
    theme: localStorage.getItem('ts-theme') || 'dark',
    env: localStorage.getItem('ts-env') || 'prod',
  });
  // effect: persist + apply theme class whenever state changes
  Store.subscribe(function (s) {
    localStorage.setItem('ts-theme', s.theme);
    localStorage.setItem('ts-env', s.env);
    document.documentElement.classList.toggle('dark', s.theme === 'dark');
  });
  function curEnv() { return ENVS.find(function (e) { return e.id === Store.get('env'); }) || ENVS[0]; }

  /* ---------------- build chrome ---------------- */
  const PAGE = window.PAGE || { id: '', title: 'Trino-Secure' };
  document.title = (PAGE.title ? PAGE.title + ' · ' : '') + 'Trino-Secure';

  // Which section/group is the active page in? (null → Design System)
  const ACTIVE_GROUP = NAV.find(function (g) { return g.items.some(function (it) { return it.id === PAGE.id; }); }) || null;

  // RAIL: one icon per top-level section + brand + design-system. Reusable cell.
  function railCell(href, ic, label, active, size) {
    return '<a href="' + href + '" title="' + label + '" class="group relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ' +
      (active ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground') + '">' +
      (active ? '<span class="absolute -left-2.5 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary"></span>' : '') +
      '<span class="[&>svg]:w-[' + (size || 20) + 'px] [&>svg]:h-[' + (size || 20) + 'px]">' + icon(ic) + '</span>' +
      '<span class="pointer-events-none absolute left-full ml-3 z-[60] hidden whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-[12px] font-medium text-popover-foreground opacity-0 shadow-md transition-opacity group-hover:opacity-100 lg:block">' + label + '</span></a>';
  }
  function railHtml() {
    return NAV.map(function (g) {
      return railCell(g.items[0].href, GROUP_ICONS[g.group] || 'dashboard', g.group, ACTIVE_GROUP && ACTIVE_GROUP.group === g.group);
    }).join('');
  }

  // CONTEXT column: header + the active section's pages + an env status card.
  function contextItem(it) {
    var active = it.id === PAGE.id;
    return '<a href="' + it.href + '" class="group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors ' +
      (active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground') + '">' +
      (active ? '<span class="absolute -left-2 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-primary"></span>' : '') +
      '<span class="flex-none [&>svg]:w-[17px] [&>svg]:h-[17px] ' + (active ? 'text-primary' : '') + '">' + icon(it.icon) + '</span>' +
      '<span class="leading-tight">' + it.label + '</span>' +
      (active ? '<span class="ml-auto h-1.5 w-1.5 flex-none rounded-full bg-primary"></span>' : '') + '</a>';
  }
  function contextBody() {
    var title = ACTIVE_GROUP ? ACTIVE_GROUP.group : 'Design System';
    var items = ACTIVE_GROUP ? ACTIVE_GROUP.items : [{ id: 'ds', label: 'Tokens & Components', href: 'design-system.html', icon: 'palette' }];
    var e = curEnv();
    return '<div class="flex h-14 items-center gap-2 border-b border-border px-4">' +
        '<span class="flex h-7 w-7 items-center justify-center rounded-md bg-primary/12 text-primary [&>svg]:w-4 [&>svg]:h-4">' + icon(ACTIVE_GROUP ? GROUP_ICONS[ACTIVE_GROUP.group] : 'palette') + '</span>' +
        '<span class="text-[13px] font-semibold tracking-tight">' + title + '</span></div>' +
      '<nav class="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">' + items.map(contextItem).join('') +
        (ACTIVE_GROUP ? '<div class="my-2 h-px bg-border/70"></div>' + contextItem({ id: 'ds', label: 'Design System', href: 'design-system.html', icon: 'palette' }) : '') +
      '</nav>' +
      '<div class="border-t border-border p-3"><div class="rounded-lg border border-border bg-card p-3">' +
        '<div class="flex items-center gap-2"><span class="dot bg-' + e.tone + '" data-ctx-dot></span><span class="text-[12px] font-semibold" data-ctx-name>' + e.name + '</span></div>' +
        '<div class="mt-2 flex items-center justify-between"><span class="mono text-[11px] text-muted-foreground" data-ctx-sub>' + e.sub + '</span><span class="badge badge-primary">rev v142</span></div>' +
      '</div></div>';
  }

  // Full grouped list — used inside the mobile nav drawer.
  function mobileNavHtml() {
    return NAV.map(function (sec) {
      return '<div class="mb-1 mt-4 px-3 first:mt-0"><p class="eyebrow mb-1.5 px-3">' + sec.group + '</p>' +
        sec.items.map(function (it) {
          var active = it.id === PAGE.id;
          return '<a href="' + it.href + '" class="relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ' +
            (active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60') + '">' +
            '<span class="flex-none [&>svg]:w-[18px] [&>svg]:h-[18px] ' + (active ? 'text-primary' : '') + '">' + icon(it.icon) + '</span>' + it.label + '</a>';
        }).join('') + '</div>';
    }).join('');
  }

  var e0 = curEnv();
  var shell = document.createElement('div');
  shell.className = 'min-h-screen w-full';
  shell.innerHTML =
    /* ---- desktop rail (64px) ---- */
    '<aside data-rail class="fixed inset-y-0 left-0 z-40 hidden w-16 flex-col items-center border-r border-border bg-card/70 py-3 backdrop-blur lg:flex">' +
      '<a href="dashboard.html" title="Trino-Secure" class="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm [&>svg]:w-[20px] [&>svg]:h-[20px]">' + icon('shield') + '</a>' +
      '<div class="my-1 h-px w-7 bg-border"></div>' +
      '<nav class="flex flex-1 flex-col items-center gap-1.5 py-1">' + railHtml() + '</nav>' +
      '<div class="my-1 h-px w-7 bg-border"></div>' +
      railCell('design-system.html', 'palette', 'Design System', PAGE.id === 'ds') +
    '</aside>' +
    /* ---- desktop context column (left of content) ---- */
    '<aside data-context class="fixed inset-y-0 left-16 z-30 hidden w-[232px] flex-col border-r border-border bg-card/40 backdrop-blur lg:flex">' + contextBody() + '</aside>' +
    /* ---- mobile nav drawer ---- */
    '<aside data-mnav class="fixed inset-y-0 left-0 z-[55] flex w-[280px] -translate-x-full flex-col border-r border-border bg-card transition-transform lg:hidden">' +
      '<div class="flex h-14 items-center gap-2.5 border-b border-border px-4">' +
        '<div class="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground [&>svg]:w-[18px] [&>svg]:h-[18px]">' + icon('shield') + '</div>' +
        '<div class="leading-tight"><div class="text-sm font-semibold">Trino-Secure</div><div class="text-[11px] text-muted-foreground">Access Control Console</div></div></div>' +
      '<nav class="flex-1 overflow-y-auto py-2">' + mobileNavHtml() + '</nav></aside>' +
    '<div data-scrim class="fixed inset-0 z-50 hidden bg-black/50 backdrop-blur-sm lg:hidden"></div>' +
    /* ---- main column ---- */
    '<div data-main class="flex min-h-screen flex-col lg:pl-[296px]">' +
      '<header class="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">' +
        '<button data-menu class="btn btn-ghost btn-icon btn-sm lg:hidden" aria-label="Open menu">' + icon('menu', 'w-[18px] h-[18px]') + '</button>' +
        '<div class="relative" data-env-wrap>' +
          '<button data-env-btn class="flex items-center gap-2.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-left transition-colors hover:bg-accent/60" aria-haspopup="listbox">' +
            '<span class="dot bg-' + e0.tone + '" data-env-dot></span>' +
            '<span class="leading-tight"><span class="block text-[13px] font-semibold" data-env-name>' + e0.name + '</span><span class="block text-[11px] text-muted-foreground mono" data-env-sub>' + e0.sub + '</span></span>' +
            '<span class="text-muted-foreground [&>svg]:w-4 [&>svg]:h-4">' + icon('chevron') + '</span></button>' +
          '<div data-env-menu class="absolute left-0 top-full z-50 mt-1.5 hidden w-64 rounded-md border border-border bg-popover p-1 shadow-lg animate-scale-in"></div>' +
        '</div>' +
        '<div class="relative ml-1 hidden max-w-md flex-1 md:block">' +
          '<span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground [&>svg]:w-4 [&>svg]:h-4">' + icon('search') + '</span>' +
          '<input data-search class="input pl-9 pr-12" placeholder="Search rules, groups, users…" /><kbd class="absolute right-3 top-1/2 -translate-y-1/2">⌘K</kbd></div>' +
        '<div class="ml-auto flex items-center gap-1">' +
          '<button data-theme class="btn btn-ghost btn-icon" aria-label="Toggle theme"><span data-theme-icon></span></button>' +
          '<button class="btn btn-ghost btn-icon relative" aria-label="Notifications">' + icon('bell', 'w-[18px] h-[18px]') + '<span class="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background"></span></button>' +
          '<div class="mx-1 h-6 w-px bg-border"></div>' +
          '<button class="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 transition-colors hover:bg-accent/60" aria-label="Account">' +
            '<span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[12px] font-semibold text-primary">AR</span>' +
            '<span class="hidden text-left leading-tight lg:block"><span class="block text-[13px] font-medium">Ava Reyes</span><span class="block text-[11px] text-muted-foreground">Security Admin</span></span></button>' +
        '</div>' +
      '</header>' +
      '<main data-content class="flex-1"></main>' +
    '</div>';

  document.body.appendChild(shell);

  // move page template content into main
  var tpl = document.getElementById('page');
  var content = shell.querySelector('[data-content]');
  if (tpl) content.appendChild(tpl.content.cloneNode(true));

  /* ---------------- theme: subscribe + toggle ---------------- */
  function renderTheme(s) {
    shell.querySelectorAll('[data-theme-icon]').forEach(function (el) { el.innerHTML = icon(s.theme === 'dark' ? 'moon' : 'sun', 'w-[18px] h-[18px]'); });
  }
  Store.subscribe(renderTheme);
  document.documentElement.classList.toggle('dark', Store.get('theme') === 'dark');
  renderTheme(Store.get());
  shell.querySelector('[data-theme]').addEventListener('click', function () { Store.set({ theme: Store.get('theme') === 'dark' ? 'light' : 'dark' }); });

  /* ---------------- env: menu + subscribe ---------------- */
  var envMenu = shell.querySelector('[data-env-menu]');
  function renderEnvMenu() {
    var cur = Store.get('env');
    envMenu.innerHTML = ENVS.map(function (e) {
      return '<button data-env-opt="' + e.id + '" class="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent">' +
        '<span class="dot bg-' + e.tone + '"></span><span class="flex-1 leading-tight"><span class="block font-medium">' + e.name + '</span><span class="mono block text-[11px] text-muted-foreground">' + e.sub + '</span></span>' +
        (e.id === cur ? '<span class="text-primary [&>svg]:w-4 [&>svg]:h-4">' + icon('check') + '</span>' : '') + '</button>';
    }).join('') + '<div class="my-1 h-px bg-border"></div><a href="environments.html" class="flex items-center gap-2 rounded-sm px-2.5 py-2 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground"><span class="[&>svg]:w-4 [&>svg]:h-4">' + icon('settings') + '</span>Manage environments</a>';
  }
  renderEnvMenu();
  // effect: reflect env into topbar + context status card
  Store.subscribe(function (s) {
    var e = ENVS.find(function (x) { return x.id === s.env; });
    shell.querySelectorAll('[data-env-name]').forEach(function (el) { el.textContent = e.name; });
    shell.querySelectorAll('[data-env-sub],[data-ctx-sub]').forEach(function (el) { el.textContent = e.sub; });
    var d = shell.querySelector('[data-env-dot]'); if (d) d.className = 'dot bg-' + e.tone + '';
    d && d.setAttribute('data-env-dot', '');
    var cd = shell.querySelector('[data-ctx-dot]'); if (cd) cd.className = 'dot bg-' + e.tone;
    var cn = shell.querySelector('[data-ctx-name]'); if (cn) cn.textContent = e.name;
    renderEnvMenu();
  });
  var envBtn = shell.querySelector('[data-env-btn]');
  envBtn.addEventListener('click', function (e) { e.stopPropagation(); envMenu.classList.toggle('hidden'); });
  envMenu.addEventListener('click', function (e) {
    var opt = e.target.closest('[data-env-opt]'); if (!opt) return;
    var ne = ENVS.find(function (x) { return x.id === opt.dataset.envOpt; });
    Store.set({ env: ne.id });
    envMenu.classList.add('hidden');
    window.dispatchEvent(new CustomEvent('env:change', { detail: ne }));
    Shell.toast({ title: 'Switched to ' + ne.name, desc: 'Now viewing ' + ne.sub, tone: ne.tone === 'destructive' ? 'warning' : 'info' });
  });
  document.addEventListener('click', function () { envMenu.classList.add('hidden'); });

  /* ---------------- mobile nav ---------------- */
  var mnav = shell.querySelector('[data-mnav]');
  var scrim = shell.querySelector('[data-scrim]');
  function openNav() { mnav.classList.remove('-translate-x-full'); scrim.classList.remove('hidden'); }
  function closeNav() { mnav.classList.add('-translate-x-full'); scrim.classList.add('hidden'); }
  shell.querySelector('[data-menu]').addEventListener('click', openNav);
  scrim.addEventListener('click', closeNav);

  /* keyboard: focus search on / */
  document.addEventListener('keydown', function (e) {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      var s = shell.querySelector('[data-search]'); if (s) { e.preventDefault(); s.focus(); }
    }
  });

  /* ================= COMPONENT LIBRARY =================
     Shell.* is the reusable component + state surface. Each helper is a
     pure-ish factory: data in → markup (or a mounted overlay) out, with
     no hidden globals. The shapes map 1:1 onto React/shadcn components:
       Shell.ui.button  → <Button variant size>
       Shell.ui.field   → <FormField label hint state>
       Shell.ui.stat    → <StatCard>
       Shell.drawer     → <Sheet side="right">
       Shell.modal      → <Dialog>
       Shell.toast      → toast() from a <Toaster>
       Shell.store      → createStore() (theme + env), subscribe-driven
     Keep new UI as small factories like these so a port stays mechanical. */
  var Shell = window.Shell = {
    icon: icon,
    store: Store,
    env: function () { return ENVS.find(function (e) { return e.id === Store.get('env'); }); },

    /* small composable render helpers — the building blocks pages reuse */
    ui: {
      button: function (o) { o = o || {}; return '<button class="btn btn-' + (o.variant || 'secondary') + (o.size ? ' btn-' + o.size : '') + '"' + (o.attrs || '') + '>' + (o.icon ? icon(o.icon, 'w-4 h-4') : '') + (o.label || '') + '</button>'; },
      field: function (o) { var t = o.state === 'error' ? 'destructive' : o.state === 'success' ? 'success' : 'muted-foreground'; return '<div class="space-y-1.5"><label class="label">' + o.label + '</label>' + o.control + (o.hint ? '<p class="flex items-center gap-1 text-[12px] text-' + t + '">' + (o.state === 'error' ? icon('alert', 'w-3.5 h-3.5') : o.state === 'success' ? icon('checkcircle', 'w-3.5 h-3.5') : '') + o.hint + '</p>' : '') + '</div>'; },
      stat: function (o) { return '<div class="card p-4"><div class="flex items-center justify-between"><span class="flex h-9 w-9 items-center justify-center rounded-md bg-' + (o.tone || 'primary') + '/12 text-' + (o.tone || 'primary') + ' [&>svg]:w-[18px] [&>svg]:h-[18px]">' + icon(o.icon) + '</span></div><div class="mt-3 text-3xl font-semibold tabular tracking-tight">' + o.value + '</div><div class="mt-0.5 text-[13px] font-medium">' + o.label + '</div>' + (o.sub ? '<div class="mt-1 text-[12px] text-muted-foreground">' + o.sub + '</div>' : '') + '</div>'; },
      pageHeader: function (o) { return '<div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">' + '<div>' + (o.eyebrow ? '<p class="eyebrow mb-1">' + o.eyebrow + '</p>' : '') + '<h1 class="text-2xl font-semibold tracking-tight">' + o.title + '</h1>' + (o.subtitle ? '<p class="mt-1 text-sm text-muted-foreground">' + o.subtitle + '</p>' : '') + '</div>' + (o.actions ? '<div class="flex flex-wrap items-center gap-2">' + o.actions + '</div>' : '') + '</div>'; },
    },

    /* drawer: {title, subtitle, body(html), footer(html), width, onMount(root)} */
    drawer: function (opts) {
      var ov = document.createElement('div'); ov.className = 'overlay animate-fade-in';
      var d = document.createElement('aside'); d.className = 'drawer animate-slide-in-right';
      if (opts.width) d.style.width = 'min(' + opts.width + 'px,100vw)';
      d.innerHTML =
        '<div class="flex items-start justify-between gap-4 border-b border-border px-6 py-4">' +
          '<div class="min-w-0"><h2 class="text-base font-semibold tracking-tight truncate">' + (opts.title || '') + '</h2>' +
          (opts.subtitle ? '<p class="mt-0.5 text-[13px] text-muted-foreground">' + opts.subtitle + '</p>' : '') + '</div>' +
          '<button data-close class="btn btn-ghost btn-icon btn-sm -mr-1 -mt-0.5">' + icon('x', 'w-[18px] h-[18px]') + '</button></div>' +
        '<div data-body class="flex-1 overflow-y-auto px-6 py-5">' + (opts.body || '') + '</div>' +
        (opts.footer ? '<div data-footer class="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3.5">' + opts.footer + '</div>' : '');
      function close() { d.style.animation = 'slide-in-right .2s reverse'; ov.style.opacity = '0'; setTimeout(function () { ov.remove(); d.remove(); }, 180); }
      ov.addEventListener('click', close);
      d.querySelector('[data-close]').addEventListener('click', close);
      document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
      document.body.appendChild(ov); document.body.appendChild(d);
      d._close = close;
      if (opts.onMount) opts.onMount(d, close);
      return d;
    },

    /* modal: {title, body, footer, icon, tone, onMount} */
    modal: function (opts) {
      var ov = document.createElement('div'); ov.className = 'overlay animate-fade-in';
      var m = document.createElement('div'); m.className = 'modal animate-scale-in';
      if (opts.width) m.style.width = 'min(' + opts.width + 'px,calc(100vw - 2rem))';
      var head = '';
      if (opts.icon) {
        var tone = opts.tone || 'primary';
        head = '<div class="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-' + tone + '/12 text-' + tone + ' [&>svg]:w-5 [&>svg]:h-5">' + icon(opts.icon) + '</div>';
      }
      m.innerHTML =
        '<div class="flex items-start gap-4 px-6 pt-6">' + head +
          '<div class="min-w-0 flex-1"><h2 class="text-base font-semibold tracking-tight">' + (opts.title || '') + '</h2>' +
          (opts.subtitle ? '<p class="mt-1 text-[13px] text-muted-foreground">' + opts.subtitle + '</p>' : '') + '</div>' +
          '<button data-close class="btn btn-ghost btn-icon btn-sm -mr-2 -mt-2">' + icon('x', 'w-[18px] h-[18px]') + '</button></div>' +
        (opts.body ? '<div data-body class="px-6 py-4">' + opts.body + '</div>' : '<div class="h-2"></div>') +
        (opts.footer ? '<div class="flex items-center justify-end gap-2 border-t border-border bg-muted/30 px-6 py-3.5">' + opts.footer + '</div>' : '');
      function close() { ov.style.opacity = '0'; m.style.opacity = '0'; m.style.transform = 'translate(-50%,-50%) scale(.97)'; setTimeout(function () { ov.remove(); m.remove(); }, 150); }
      ov.addEventListener('click', close);
      m.querySelector('[data-close]').addEventListener('click', close);
      document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); } });
      document.body.appendChild(ov); document.body.appendChild(m);
      m._close = close;
      if (opts.onMount) opts.onMount(m, close);
      return m;
    },

    confirm: function (opts) {
      return Shell.modal({
        title: opts.title, subtitle: opts.subtitle, icon: opts.icon || 'alert', tone: opts.tone || 'destructive',
        footer: '<button data-cancel class="btn btn-outline">' + (opts.cancelText || 'Cancel') + '</button>' +
          '<button data-ok class="btn btn-' + (opts.tone === 'warning' ? 'primary' : (opts.tone || 'destructive')) + '">' + (opts.okText || 'Confirm') + '</button>',
        onMount: function (m, close) {
          m.querySelector('[data-cancel]').addEventListener('click', close);
          m.querySelector('[data-ok]').addEventListener('click', function () { close(); if (opts.onConfirm) opts.onConfirm(); });
        },
      });
    },

    /* toast: {title, desc, tone} */
    toast: function (opts) {
      var wrap = document.getElementById('toast-wrap');
      if (!wrap) { wrap = document.createElement('div'); wrap.id = 'toast-wrap'; wrap.className = 'fixed bottom-5 right-5 z-[90] flex flex-col gap-2.5 w-[360px] max-w-[calc(100vw-2rem)]'; document.body.appendChild(wrap); }
      var tone = opts.tone || 'info';
      var ic = { success: 'checkcircle', info: 'info', warning: 'alert', destructive: 'alert', primary: 'checkcircle' }[tone] || 'info';
      var t = document.createElement('div');
      t.className = 'card flex items-start gap-3 p-3.5 shadow-lg animate-toast-in';
      t.innerHTML = '<span class="flex-none mt-0.5 text-' + tone + ' [&>svg]:w-[18px] [&>svg]:h-[18px]">' + icon(ic) + '</span>' +
        '<div class="min-w-0 flex-1"><p class="text-[13px] font-semibold">' + (opts.title || '') + '</p>' + (opts.desc ? '<p class="mt-0.5 text-[12px] text-muted-foreground">' + opts.desc + '</p>' : '') + '</div>' +
        '<button class="btn btn-ghost btn-icon btn-sm -mr-1 -mt-1">' + icon('x', 'w-4 h-4') + '</button>';
      function rm() { t.style.opacity = '0'; t.style.transform = 'translateX(8px)'; t.style.transition = '.18s'; setTimeout(function () { t.remove(); }, 180); }
      t.querySelector('button').addEventListener('click', rm);
      wrap.appendChild(t);
      setTimeout(rm, opts.duration || 4200);
    },

    /* drag-to-reorder rows. tbody: element; opts.onReorder(fromIndex,toIndex) */
    dragOrder: function (tbody, onReorder) {
      var dragEl = null;
      tbody.querySelectorAll('[draggable="true"]').forEach(bind);
      function bind(row) {
        row.addEventListener('dragstart', function (e) { dragEl = row; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
        row.addEventListener('dragend', function () { row.classList.remove('dragging'); tbody.querySelectorAll('.drag-over').forEach(function (r) { r.classList.remove('drag-over'); }); });
        row.addEventListener('dragover', function (e) { e.preventDefault(); if (row !== dragEl) row.classList.add('drag-over'); });
        row.addEventListener('dragleave', function () { row.classList.remove('drag-over'); });
        row.addEventListener('drop', function (e) {
          e.preventDefault(); row.classList.remove('drag-over');
          if (!dragEl || dragEl === row) return;
          var rows = Array.from(tbody.children);
          var from = rows.indexOf(dragEl), to = rows.indexOf(row);
          if (from < to) tbody.insertBefore(dragEl, row.nextSibling); else tbody.insertBefore(dragEl, row);
          if (onReorder) onReorder(from, to);
        });
      }
    },

    badge: function (kind) {
      var map = {
        Draft: ['neutral', 'edit'], Valid: ['success', 'checkcircle'], Invalid: ['destructive', 'alert'],
        Published: ['primary', 'rocket'], 'Drift detected': ['warning', 'drift'], Enabled: ['success', 'check'],
        Disabled: ['neutral', 'x'], Active: ['success', 'check'], Expired: ['destructive', 'alert'],
      };
      var m = map[kind] || ['neutral', null];
      return '<span class="badge badge-' + m[0] + '">' + (m[1] ? icon(m[1]) : '') + kind + '</span>';
    },
  };

  window.dispatchEvent(new CustomEvent('shell:ready'));
})();
