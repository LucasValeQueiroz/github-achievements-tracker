/**
 * Bilingual internationalization dictionary (PT-BR / EN) and translator helper.
 */

export const TRANSLATIONS = {
  pt: {
    appTitle: 'GitHub Achievements Tracker',
    appSubtitle: 'Acompanhe seu progresso real nas conquistas do GitHub via REST API, gere trailers Co-authored-by e exporte badges para seu Profile README.',
    docsLink: 'Documentação da API',
    repoLink: 'Repositório',
    starCta: 'Star no GitHub',
    tryExamples: 'Testar rápido:',
    searchPlaceholder: 'Digite um usuário do GitHub (ex: LucasValeQueiroz)',
    searchButton: 'Analisar perfil',
    tokenToggle: 'Token opcional (aumenta rate limit)',
    tokenPlaceholder: 'ghp_... (fica apenas no seu navegador)',
    rememberToken: 'Lembrar token apenas neste navegador',
    tokenHint: 'Opcional: a API pública permite 60 req/h por IP; com token pessoal sobe para 5.000 req/h. Nunca enviado a terceiros.',
    lastUpdated: 'Atualizado às {time}',
    refreshNow: 'Atualizar agora',
    autoRefreshOn: 'Auto-atualizar: ON',
    autoRefreshOff: 'Auto-atualizar: OFF',
    loading: 'Consultando a GitHub REST API...',
    errorNotFound: 'Usuário não encontrado no GitHub. Verifique o username e tente novamente.',
    errorRateLimit: 'Limite da GitHub API atingido. Aguarde alguns minutos ou informe um token pessoal opcional.',
    errorGeneric: 'Não foi possível consultar a GitHub API agora. Tente novamente.',
    statsMergedPrs: 'PRs Públicos Mergeados',
    statsTopStars: 'Maior nº de Estrelas',
    statsTotalStars: 'Total de Estrelas',
    statsUnlocked: 'Conquistas Ativas',
    sectionAchievements: 'Conquistas Ativas (Achievements)',
    sectionAchievementsSub: 'Progresso calculado automaticamente pela GitHub API onde disponível, com ajuste manual para métricas privadas/Discussions.',
    sectionNextSteps: 'Próximos passos recomendados',
    sectionTopRepos: 'Top Repositórios Públicos (Starstruck)',
    sectionToolkit: 'Ferramentas Práticas',
    sectionHighlights: 'Profile Highlights & Aposentados',
    badgeApi: 'Via GitHub API',
    badgeInferred: 'Inferido',
    badgeManual: 'Manual',
    tierLocked: 'Bloqueado',
    tierMax: 'Nível máximo atingido',
    tierNext: 'Próximo: {label} (faltam {remaining})',
    quickdrawEvidence: 'Detectado fechamento em {seconds}s',
    noRepos: 'Nenhum repositório público próprio encontrado.',
    coauthorTitle: 'Gerador Pair Extraordinaire (Co-authored-by)',
    coauthorDesc: 'Busque o username real de um colega/colaborador para gerar o trailer com o e-mail noreply verificado do GitHub.',
    coauthorUserPlaceholder: 'Username do colaborador (ex: octocat)',
    coauthorMsgPlaceholder: 'Mensagem do commit (ex: feat: implementa integração)',
    coauthorGenerate: 'Gerar trailer',
    coauthorCopy: 'Copiar comando git',
    copied: 'Copiado!',
    galaxyTitle: 'Encontrar Discussions Q&A (Galaxy Brain)',
    galaxyDesc: 'Links filtrados para discussões abertas e sem resposta nas linguagens detectadas no perfil:',
    paceTitle: 'Calculadora de Ritmo (Pull Shark)',
    paceDesc: 'Simule quantos dias faltam para cada nível do Pull Shark mantendo entregas reais em GitHub Flow:',
    paceLabel: 'Ritmo diário',
    paceUnit: 'PRs reais/dia',
    paceReached: 'Conquistado',
    paceDays: '{days} dias ({date})',
    paceRemaining: 'faltam {count}',
    skinToneTitle: 'Tom de Pele das Conquistas',
    skinToneDesc: 'As conquistas Quickdraw e Starstruck acompanham sua preferência de tom de pele de emoji no GitHub:',
    skinToneSelected: 'Selecionado: {label}',
    skinToneAction: 'Configurar no GitHub ↗',
    historyTitle: 'Histórico Local de Progresso',
    historyDesc: 'Snapshots salvos no seu navegador (localStorage) para acompanhar a evolução entre consultas:',
    historyFirst: 'Primeiro snapshot salvo! Volte após novos PRs ou estrelas para ver o delta de evolução.',
    historyNoChange: 'Sem alterações desde o snapshot anterior.',
    historyClear: 'Limpar histórico',
    historyCleared: 'Histórico limpo para este perfil.',
    compareTitle: 'Comparar Perfis Lado a Lado',
    compareDesc: 'Compare o perfil atual com qualquer outro dev do GitHub em PRs, estrelas e conquistas:',
    comparePlaceholder: 'Outro username (ex: gaearon ou m4rcelao)',
    compareBtn: 'Comparar',
    compareMetric: 'Métrica',
    compareScore: 'Placar: @{left} {leftWins} × {rightWins} @{right}',
    compareMetrics: {
      mergedPullRequests: 'PRs Mergeados',
      maxRepoStars: 'Top Repo ⭐',
      totalStars: 'Total ⭐',
      unlockedCount: 'Conquistas Ativas',
      followers: 'Followers'
    },
    exportTitle: 'Exportar para Profile README / JSON',
    exportDesc: 'Copie o bloco Markdown pronto com Shields.io para colar no README do seu perfil ou baixe o relatório JSON.',
    copyMarkdown: 'Copiar Markdown',
    downloadJson: 'Baixar JSON',
    downloadCardPng: 'Baixar Card (PNG)',
    downloadCardSvg: 'Baixar Card (SVG)',
    generatingCard: 'Gerando PNG...',
    shareUrl: 'Copiar link do perfil',
    socialPostTitle: 'Gerador de Post (LinkedIn / X)',
    socialPostDesc: 'Gere um resumo pronto das suas conquistas com link direto para compartilhar seu progresso:',
    socialCopyPost: 'Copiar post',
    socialOpenX: 'Abrir no X ↗',
    socialOpenLinkedIn: 'Compartilhar no LinkedIn ↗',
    highlightsTitle: 'Profile Highlights (abaixo da bio)',
    retiredTitle: 'Conquistas Aposentadas (não mais obtíveis)',
    rateLimitInfo: 'API Rate Limit restante: {remaining}/{limit}',
    achievements: {
      'pull-shark': {
        desc: 'Abra Pull Requests que sejam mergeados na branch padrão.',
        tip: 'Mantenha entregas organizadas em branches e mergeie PRs em repositórios públicos.'
      },
      starstruck: {
        desc: 'Tenha um repositório próprio recebendo estrelas da comunidade.',
        tip: 'Publique ferramentas úteis com bom README, demo no GitHub Pages e compartilhe com devs.'
      },
      quickdraw: {
        desc: 'Feche uma Issue ou Pull Request em menos de 5 minutos após abrir.',
        tip: 'Abra uma issue ou PR em um repositório público e feche dentro da janela de 5 minutos.'
      },
      yolo: {
        desc: 'Faça merge de um Pull Request sem revisão de código.',
        tip: 'Ao dar merge direto no seu próprio PR sem reviewer aprovado, desbloqueia o badge.'
      },
      'pair-extraordinaire': {
        desc: 'Co-autorize commits em um PR mergeado usando Co-authored-by.',
        tip: 'Use o gerador abaixo com um colaborador real para adicionar o trailer no commit do PR.'
      },
      'galaxy-brain': {
        desc: 'Tenha respostas marcadas como Accepted Answer em GitHub Discussions.',
        tip: 'Responda dúvidas técnicas em repositórios open-source com Discussions Q&A ativado.'
      },
      'public-sponsor': {
        desc: 'Patrocine um desenvolvedor ou projeto no GitHub Sponsors.',
        tip: 'Mesmo um patrocínio único a partir de US$ 1 no GitHub Sponsors desbloqueia este badge.'
      }
    },
    highlights: {
      'developer-program': 'Gratuito: construa uma integração com a API do GitHub + docs e registre-se no Developer Program.',
      'github-pro': 'Assinatura GitHub Pro (ou gratuito para estudantes no GitHub Student Developer Pack).',
      'campus-expert': 'Programa oficial de liderança estudantil em tecnologia do GitHub Education.',
      'security-bounty': 'Concedido a pesquisadores que reportam vulnerabilidades válidas no GitHub Bug Bounty.'
    },
    retired: {
      'arctic-code-vault': 'Concedido a repositórios arquivados no GitHub Archive Program (2020).',
      'mars-2020': 'Concedido a contribuidores de bibliotecas usadas no helicóptero Ingenuity da NASA (2020).'
    }
  },
  en: {
    appTitle: 'GitHub Achievements Tracker',
    appSubtitle: 'Track real progress across GitHub Profile Achievements via REST API, generate Co-authored-by trailers, and export Profile README badges.',
    docsLink: 'API Docs',
    repoLink: 'Repository',
    starCta: 'Star on GitHub',
    tryExamples: 'Quick try:',
    searchPlaceholder: 'Enter a GitHub username (e.g. LucasValeQueiroz)',
    searchButton: 'Analyze Profile',
    tokenToggle: 'Optional token (higher rate limit)',
    tokenPlaceholder: 'ghp_... (stays in your browser only)',
    rememberToken: 'Remember token in this browser only',
    tokenHint: 'Optional: unauthenticated REST API allows 60 req/hr per IP; a personal token raises it to 5,000 req/hr. Never sent anywhere else.',
    lastUpdated: 'Updated at {time}',
    refreshNow: 'Refresh now',
    autoRefreshOn: 'Auto-refresh: ON',
    autoRefreshOff: 'Auto-refresh: OFF',
    loading: 'Querying the GitHub REST API...',
    errorNotFound: 'GitHub user not found. Double-check the username and try again.',
    errorRateLimit: 'GitHub API rate limit reached. Wait a few minutes or supply an optional personal token.',
    errorGeneric: 'Unable to reach the GitHub API right now. Please try again.',
    statsMergedPrs: 'Merged Public PRs',
    statsTopStars: 'Top Repo Stars',
    statsTotalStars: 'Total Stars',
    statsUnlocked: 'Active Achievements',
    sectionAchievements: 'Active Achievements',
    sectionAchievementsSub: 'Computed automatically from GitHub REST API where public data exists, with manual tracking for Discussions & co-authored metrics.',
    sectionNextSteps: 'Recommended Next Steps',
    sectionTopRepos: 'Top Public Repositories (Starstruck)',
    sectionToolkit: 'Interactive Toolkit',
    sectionHighlights: 'Profile Highlights & Retired Badges',
    badgeApi: 'GitHub API',
    badgeInferred: 'Inferred',
    badgeManual: 'Manual',
    tierLocked: 'Locked',
    tierMax: 'Max tier reached',
    tierNext: 'Next: {label} ({remaining} left)',
    quickdrawEvidence: 'Detected close in {seconds}s',
    noRepos: 'No owned public repositories found.',
    coauthorTitle: 'Pair Extraordinaire Generator (Co-authored-by)',
    coauthorDesc: 'Look up a real collaborator username to generate a verified GitHub noreply Co-authored-by trailer.',
    coauthorUserPlaceholder: 'Collaborator username (e.g. octocat)',
    coauthorMsgPlaceholder: 'Commit summary (e.g. feat: add integration)',
    coauthorGenerate: 'Generate trailer',
    coauthorCopy: 'Copy git command',
    copied: 'Copied!',
    galaxyTitle: 'Find Open Q&A Discussions (Galaxy Brain)',
    galaxyDesc: 'Filtered search links for open unanswered Discussions in the profile primary languages:',
    paceTitle: 'Pull Shark Pace Calculator',
    paceDesc: 'Estimate how many days remain for every Pull Shark tier at a sustainable GitHub Flow pace:',
    paceLabel: 'Daily pace',
    paceUnit: 'real PRs/day',
    paceReached: 'Unlocked',
    paceDays: '{days} days ({date})',
    paceRemaining: '{count} left',
    skinToneTitle: 'Achievement Skin Tone Preference',
    skinToneDesc: 'Quickdraw and Starstruck adapt to your Emoji skin tone preference in GitHub Appearance settings:',
    skinToneSelected: 'Selected: {label}',
    skinToneAction: 'Open GitHub Appearance ↗',
    historyTitle: 'Local Progress History',
    historyDesc: 'Browser-only snapshots (localStorage) tracking how this profile evolves across visits:',
    historyFirst: 'First snapshot saved! Come back after new PRs or stars to see your progress delta.',
    historyNoChange: 'No metric changes since the previous snapshot.',
    historyClear: 'Clear history',
    historyCleared: 'History cleared for this profile.',
    compareTitle: 'Compare Profiles Side by Side',
    compareDesc: 'Compare the current profile against any other GitHub user across PRs, stars, and achievements:',
    comparePlaceholder: 'Another username (e.g. gaearon)',
    compareBtn: 'Compare',
    compareMetric: 'Metric',
    compareScore: 'Score: @{left} {leftWins} – {rightWins} @{right}',
    compareMetrics: {
      mergedPullRequests: 'Merged PRs',
      maxRepoStars: 'Top Repo ⭐',
      totalStars: 'Total ⭐',
      unlockedCount: 'Active Achievements',
      followers: 'Followers'
    },
    exportTitle: 'Export to Profile README / JSON',
    exportDesc: 'Copy a ready-to-paste Markdown block with Shields.io badges or download the full JSON report.',
    copyMarkdown: 'Copy Markdown',
    downloadJson: 'Download JSON',
    downloadCardPng: 'Download Card (PNG)',
    downloadCardSvg: 'Download Card (SVG)',
    generatingCard: 'Generating PNG...',
    shareUrl: 'Copy share link',
    socialPostTitle: 'Social Share Post (LinkedIn / X)',
    socialPostDesc: 'Generate a ready-to-paste summary of your unlocked achievements with a direct profile link:',
    socialCopyPost: 'Copy post',
    socialOpenX: 'Post on X ↗',
    socialOpenLinkedIn: 'Share on LinkedIn ↗',
    highlightsTitle: 'Profile Highlights (below bio)',
    retiredTitle: 'Retired Achievements (no longer obtainable)',
    rateLimitInfo: 'API Rate Limit remaining: {remaining}/{limit}',
    achievements: {
      'pull-shark': {
        desc: 'Open Pull Requests that get merged into the default branch.',
        tip: 'Keep feature work organized into clean branches and merge PRs on public repositories.'
      },
      starstruck: {
        desc: 'Own a public repository that receives stars from the community.',
        tip: 'Build useful tools with clear docs, live GitHub Pages demos, and share them openly.'
      },
      quickdraw: {
        desc: 'Close an Issue or Pull Request within 5 minutes of opening it.',
        tip: 'Open an issue or PR in a public repository and close it within the 5-minute window.'
      },
      yolo: {
        desc: 'Merge a Pull Request without a code review.',
        tip: 'Merging a pull request directly without a reviewer unlocks this one-tier badge.'
      },
      'pair-extraordinaire': {
        desc: 'Co-author commits on a merged pull request using Co-authored-by.',
        tip: 'Use the generator below with a real teammate to include the verified co-author trailer.'
      },
      'galaxy-brain': {
        desc: 'Have replies marked as Accepted Answer in GitHub Discussions.',
        tip: 'Help solve questions in open-source repositories that enable Q&A Discussions.'
      },
      'public-sponsor': {
        desc: 'Sponsor an open-source developer or project via GitHub Sponsors.',
        tip: 'Even a one-time $1 sponsorship on GitHub Sponsors unlocks this profile badge.'
      }
    },
    highlights: {
      'developer-program': 'Free: build an integration using the GitHub API + docs site and join the Developer Program.',
      'github-pro': 'Active GitHub Pro subscription (or free for students via GitHub Student Developer Pack).',
      'campus-expert': 'Official student community leadership recognition from GitHub Education.',
      'security-bounty': 'Awarded to researchers who responsibly disclose valid vulnerabilities to GitHub.'
    },
    retired: {
      'arctic-code-vault': 'Awarded for code stored in the 2020 GitHub Archive Program.',
      'mars-2020': 'Awarded to contributors of open-source code used in NASA Ingenuity helicopter (2020).'
    }
  }
};

/**
 * Resolves a dotted translation key with simple `{token}` interpolation.
 * @param {'pt'|'en'} lang
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 */
export function t(lang, key, params = {}) {
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.pt;
  const parts = key.split('.');
  let current = dict;
  for (const part of parts) {
    current = current?.[part];
  }
  const template = typeof current === 'string' ? current : key;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}
