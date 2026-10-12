// Everything the profile says lives here. Edit, then run `npm run build` inside tools/.

// Where the committed SVGs are served from. Absolute on purpose: the GitHub mobile apps do not
// resolve relative image paths inside <picture>. Change it if the repo or default branch is renamed.
export const assetBase = 'https://raw.githubusercontent.com/HuzinaPatrik/HuzinaPatrik/main/assets';

export const profile = {
  name: 'Patrik Huzina',
  // Rendered in the hero. `tone` picks the discipline colour, null = neutral text.
  roleLine: [
    { text: 'Full-stack engineer', tone: 'build' },
    { text: ', ', tone: null },
    { text: 'systems administrator', tone: 'run' },
    { text: ' and ', tone: null },
    { text: 'AI engineer', tone: 'ai' },
    { text: '.', tone: null },
  ],
  email: 'patrikhuzina@gmail.com',
};

// Three disciplines, three signal colours. Dark values sit on #121824, light values on #FFFFFF;
// all of them pass WCAG AA (4.5:1) against their panel.
export const themes = {
  dark: {
    faceTop: '#151C2A', faceBottom: '#0F141E', border: '#232C3D', sheen: '#FFFFFF',
    chip: '#19212F', chipBorder: '#283347', chipText: '#CDD5E3',
    text: '#E9EDF5', text2: '#A7B1C5', muted: '#8591A8',
    dot: '#FFFFFF', dotOpacity: 0.11, glow: 0.16, tile: 0.13,
    // hairlines drawn straight on the page: translucent, so they show on every GitHub canvas
    // (dark #0d1117, dimmed #22272e, high contrast #010409)
    rule: '#8B98AD', ruleOpacity: 0.3,
    tones: { build: '#F7BC50', run: '#53E2A6', ai: '#B59AFF' },
  },
  light: {
    faceTop: '#FFFFFF', faceBottom: '#F6F8FB', border: '#D8DEE8', sheen: '#FFFFFF',
    chip: '#F2F5F9', chipBorder: '#DCE2EB', chipText: '#1E293B',
    text: '#0F172A', text2: '#475569', muted: '#64748B',
    dot: '#0F172A', dotOpacity: 0.10, glow: 0.10, tile: 0.10,
    rule: '#64748B', ruleOpacity: 0.3,
    tones: { build: '#A96000', run: '#007D51', ai: '#6B40C9' },
  },
};

export const disciplines = [
  {
    id: 'build',
    lane: 'full-stack',
    title: 'Full-stack engineering',
    cards: [
      { id: 'languages', icon: 'braces', title: 'Languages',
        chips: ['TypeScript', 'JavaScript', 'Python', 'Java', 'C#', 'C / C++', 'PHP', 'Rust', 'Ruby', 'Lua'] },
      { id: 'frontend', icon: 'app-window', title: 'Frontend',
        chips: ['React', 'Next.js', 'Vue', 'Svelte', 'Tailwind CSS', 'HTML', 'CSS / SCSS'] },
      { id: 'backend', icon: 'server-cog', title: 'Backend & APIs',
        chips: ['Node.js', 'Express', 'Laravel', 'Spring', 'Django', 'Flask', 'REST APIs'] },
      { id: 'databases', icon: 'database', title: 'Databases',
        chips: ['PostgreSQL', 'MySQL', 'MariaDB', 'MongoDB', 'Redis', 'Schema design', 'Query tuning'] },
      { id: 'game-servers', icon: 'gamepad-2', title: 'Game servers',
        chips: ['FiveM', 'MTA:SA', 'alt:V', 'Lua', 'NUI / HUDs'] },
      { id: 'tooling', icon: 'pen-tool', title: 'Design & tooling',
        chips: ['Figma', 'Photoshop', 'Git', 'GitHub', 'Postman'] },
    ],
  },
  {
    id: 'run',
    lane: 'infrastructure',
    title: 'Systems & infrastructure',
    cards: [
      { id: 'linux', icon: 'terminal', title: 'Linux servers',
        chips: ['Ubuntu', 'Debian', 'Nginx', 'Apache', 'systemd', 'Bash', 'SSH hardening', 'Firewalls', 'Backups'] },
      { id: 'virtualization', icon: 'hard-drive', title: 'Virtualization & hardware',
        chips: ['Proxmox', 'VMware', 'Hyper-V', 'NAS & storage', 'Server hardware', 'Homelab'] },
      { id: 'windows', icon: 'monitor-cog', title: 'Windows & Microsoft 365',
        chips: ['Windows Server', 'Active Directory', 'Group Policy', 'PowerShell', 'Microsoft 365', 'Exchange'] },
      { id: 'networking', icon: 'network', title: 'Networking',
        chips: ['MikroTik', 'Cisco', 'Ubiquiti', 'VLANs', 'WireGuard', 'OpenVPN', 'DNS / DHCP', 'pfSense', 'OPNsense'] },
      { id: 'containers', icon: 'container', title: 'Containers & CI/CD',
        chips: ['Docker', 'Kubernetes', 'Jenkins', 'GitHub Actions', 'GitLab CI'] },
      { id: 'cloud', icon: 'cloud', title: 'Cloud & hosting',
        chips: ['AWS', 'Azure', 'Google Cloud', 'Hetzner', 'DigitalOcean', 'OVH', 'Cloudflare', 'Vercel'] },
      { id: 'monitoring', icon: 'activity', title: 'Monitoring',
        chips: ['Grafana', 'Prometheus', 'Zabbix', 'Uptime Kuma', 'Logging', 'Alerting'] },
      { id: 'automation', icon: 'key-round', title: 'Automation & identity',
        chips: ['Ansible', 'Terraform', 'Keycloak', 'SSO', 'Reverse proxies', 'SSL / TLS'] },
    ],
  },
  {
    id: 'ai',
    lane: 'ai',
    title: 'AI engineering',
    cards: [
      { id: 'llm', icon: 'bot-message-square', title: 'LLM applications',
        chips: ['OpenAI API', 'Claude API', 'Gemini API', 'Prompt engineering', 'Structured output', 'Streaming', 'ElevenLabs'] },
      { id: 'ml', icon: 'brain-circuit', title: 'ML & local models',
        chips: ['PyTorch', 'TensorFlow', 'Hugging Face', 'Ollama', 'Fine-tuning', 'NLP', 'Computer vision'] },
      { id: 'rag', icon: 'file-search', title: 'RAG & search',
        chips: ['Embeddings', 'pgvector', 'Pinecone', 'Qdrant', 'Semantic search', 'Source-cited chat'] },
      { id: 'agents', icon: 'workflow', title: 'Agents & MCP',
        chips: ['Custom agents', 'Tool use', 'MCP servers', 'Claude Code', 'n8n', 'Automation'] },
    ],
  },
];
