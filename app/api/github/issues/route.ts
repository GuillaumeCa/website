import { NextResponse } from 'next/server';

// Note: Comments are intentionally in English.

const REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;

const buildIssuesUrl = (repo: string) =>
  `https://api.github.com/repos/${repo}/issues?state=open&per_page=50`;

type GitHubLabel = { name: string };

function extractLabeledValue(labels: GitHubLabel[], prefix: string): string | null {
  const match = labels.find((l) => l.name.toLowerCase().startsWith(prefix.toLowerCase()));
  if (!match) return null;
  const parts = match.name.split(':');
  return parts[1]?.trim() ?? null;
}

function mapIssueToLeanTask(issue: any) {
  const labels: GitHubLabel[] = Array.isArray(issue.labels) ? issue.labels : [];
  const status = extractLabeledValue(labels, 'status:');
  const difficulty = extractLabeledValue(labels, 'difficulty:');
  const category = extractLabeledValue(labels, 'category:');
  const assignees = Array.isArray(issue.assignees) ? issue.assignees : [];

  return {
    id: String(issue.id),
    title: issue.title ?? 'Untitled',
    description: issue.body ?? '',
    category,
    status,
    difficulty,
    tags: labels.map((l) => l.name).filter(Boolean),
    // Expose assignees as contributors; client will map to TaskContributor
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
    number: issue.number
  };
}

export async function GET() {
  if (!REPO || !TOKEN) {
    return NextResponse.json({ error: 'GitHub is not configured' }, { status: 400 });
  }

  const res = await fetch(buildIssuesUrl(REPO), {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'User-Agent': 'dying-star-contrib',
      Accept: 'application/vnd.github+json'
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    const detail = await res.text();
    return NextResponse.json({ error: 'GitHub fetch failed', detail }, { status: res.status });
  }

  const issues = await res.json();
  const mapped = Array.isArray(issues)
    ? issues.filter((i) => !i.pull_request).map(mapIssueToLeanTask)
    : [];
  return NextResponse.json({ issues: mapped });
}


