import { NextResponse } from 'next/server';

const BASE_REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;

// Liste des sous-repositories à récupérer
const SUB_REPOS = [
  'website',
  'godotandaddons',
  'horizonserver',
  'DyingStar',
  'servers',
  'Project',
  'launcher',
  'SDO',
  'wwise-godot-integration',
  'Lore',
  'Plan'
];

const buildIssuesUrl = (repo: string) =>
  `https://api.github.com/repos/${repo}/issues?state=open&per_page=50`;

const buildReposUrl = (org: string) =>
  `https://api.github.com/orgs/${org}/repos?type=all&per_page=100`;

type GitHubLabel = { name: string };

function extractLabeledValue(labels: GitHubLabel[], prefix: string): string | null {
  const match = labels.find((l) => l.name.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!match) return null;
  const parts = match.name.split(':');
  return parts[1]?.trim() ?? null;
}

// Mapping des repositories aux catégories
const REPOSITORY_CATEGORY_MAP: Record<string, string> = {
  'Lore': 'Narrative',
  'DyingStar': 'Dev',
  'horizonserver': 'Tech',
  'godotandaddons': 'Tech',
  'servers': 'Tech',
  'launcher': 'Tech',
  'wwise-godot-integration': 'Tech',
  'SDO': 'Tech',
  'website': 'Dev',
  'Project': 'Tech',
  'Plan': 'Autre'
  // Tous les autres repositories seront mappés vers 'Autre' par défaut
};

function mapIssueToLeanTask(issue: any, repository: string) {
  const labels: GitHubLabel[] = Array.isArray(issue.labels) ? issue.labels : [];
  const status = extractLabeledValue(labels, 'status:');
  const difficulty = extractLabeledValue(labels, 'difficulty:');
  
  // Utiliser le mapping repository -> catégorie, ou fallback sur les labels, ou 'Autre' par défaut
  const category = REPOSITORY_CATEGORY_MAP[repository] || extractLabeledValue(labels, 'category:') || 'Autre';
  
  const assignees = Array.isArray(issue.assignees) ? issue.assignees : [];

  return {
    id: String(issue.id),
    title: issue.title ?? 'Untitled',
    description: issue.body ?? '',
    category,
    status,
    difficulty,
    tags: labels.map((l) => l.name).filter(Boolean),
    contributors: assignees.map((u: any) => ({
      id: String(u.id ?? u.login ?? Math.random()),
      user_id: String(u.id ?? u.login ?? 'unknown'),
      username: String(u.login ?? 'contributor'),
      avatar_url: typeof u.avatar_url === 'string' ? u.avatar_url : null,
      role: null,
      claimed_at: null
    })),
    created_at: issue.created_at,
    updated_at: issue.updated_at,
    html_url: issue.html_url,
    number: issue.number,
    repository: repository
  };
}

export async function GET() {
  console.log('=== GitHub API called ===');
  console.log('BASE_REPO:', BASE_REPO);
  console.log('TOKEN exists:', !!TOKEN);
  console.log('Environment variables:', {
    GITHUB_REPO: process.env.GITHUB_REPO,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN ? 'SET' : 'NOT SET'
  });
  
  // Utiliser des repositories spécifiques connus pour les tests
  const testRepositories = [
    'microsoft/vscode',
    'facebook/react',
    'microsoft/TypeScript'
  ];
  
  // Si BASE_REPO est configuré, essayer de récupérer les repositories de l'organisation
  let repositoriesToUse = testRepositories;
  
  // Pour les tests, utiliser DyingStar-game même si BASE_REPO n'est pas configuré
  const targetOrg = BASE_REPO || 'DyingStar-game';
  
  if (targetOrg) {
    console.log(`Attempting to fetch repositories from organization: ${targetOrg}`);
    
    try {
      const reposUrl = buildReposUrl(targetOrg);
      const headers: Record<string, string> = {
        'User-Agent': 'dying-star-contrib',
        Accept: 'application/vnd.github+json'
      };
      
      if (TOKEN) {
        headers.Authorization = `Bearer ${TOKEN}`;
      }
      
      const reposRes = await fetch(reposUrl, { headers, cache: 'no-store' });
      
      if (reposRes.ok) {
        const repositories = await reposRes.json();
        if (Array.isArray(repositories)) {
          // Filtrer les repositories qui correspondent à nos sous-repositories
          const matchingRepos = repositories.filter(repo => 
            SUB_REPOS.includes(repo.name)
          );
          
          if (matchingRepos.length > 0) {
            repositoriesToUse = matchingRepos.map(repo => `${targetOrg}/${repo.name}`);
            console.log(`Found ${matchingRepos.length} matching repositories:`, matchingRepos.map(r => r.name));
          } else {
            console.log(`No matching repositories found, using test repositories`);
          }
        }
      } else {
        console.log(`Failed to fetch repositories from ${targetOrg}, using test repositories`);
      }
    } catch (error) {
      console.log(`Error fetching repositories from ${targetOrg}, using test repositories:`, error);
    }
  }
  
  console.log(`Using repositories: ${repositoriesToUse.join(', ')}`);

  const allIssues: any[] = [];
  const errors: string[] = [];
  const foundRepositories: string[] = [];

  // Récupérer les issues de chaque repository
  for (const repoName of repositoriesToUse) {
    console.log(`Fetching issues from ${repoName}`);
    
    try {
      const url = buildIssuesUrl(repoName);
      console.log(`Issues URL: ${url}`);
      
      const headers: Record<string, string> = {
        'User-Agent': 'dying-star-contrib',
        Accept: 'application/vnd.github+json'
      };
      
      if (TOKEN) {
        headers.Authorization = `Bearer ${TOKEN}`;
      }
      
      const res = await fetch(url, {
        headers,
        cache: 'no-store'
      });

      console.log(`Response status for ${repoName}: ${res.status}`);

      if (!res.ok) {
        const detail = await res.text();
        console.log(`Error response for ${repoName}:`, detail);
        errors.push(`Failed to fetch issues from ${repoName}: ${res.status} ${detail}`);
        continue;
      }

      const issues = await res.json();
      console.log(`Found ${issues.length} issues in ${repoName}`);
      
      if (Array.isArray(issues)) {
        const filteredIssues = issues.filter((i) => !i.pull_request);
        console.log(`Filtered to ${filteredIssues.length} issues (excluding PRs)`);
        allIssues.push(...filteredIssues.map(issue => mapIssueToLeanTask(issue, repoName.split('/')[1])));
        foundRepositories.push(repoName.split('/')[1]);
      }
    } catch (error) {
      console.error(`Error fetching issues from ${repoName}:`, error);
      errors.push(`Error fetching issues from ${repoName}: ${error}`);
    }
  }

  console.log(`Total issues found: ${allIssues.length}`);
  console.log(`Found repositories: ${foundRepositories.length}`);
  console.log(`Errors: ${errors.length}`);

  return NextResponse.json({ 
    issues: allIssues,
    repositories: foundRepositories,
    totalIssues: allIssues.length,
    errors: errors.length > 0 ? errors : undefined
  });
}
