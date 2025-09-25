'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Task,
  TaskContributor,
  TaskDifficulty,
  TaskStatus,
  TaskCategory,
  normalizeTaskCategory,
  normalizeTaskDifficulty,
  normalizeTaskStatus,
  TASK_STATUS_ORDER
} from '@lib/tasks-data';

const generateLocalId = () =>
  typeof globalThis !== 'undefined' &&
  'crypto' in globalThis &&
  typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

type TaskTableShape = {
  id: 'en' | 'fr' | 'hybrid';
  title: string;
  description: string;
  category: string;
  status: string;
  difficulty: string;
  contributors: string;
  requiredRoles?: string;
  deliverables?: string;
  tags?: string;
  max_contributors?: string;
};

const TABLE_SHAPES: TaskTableShape[] = [
  {
    id: 'en',
    title: 'title',
    description: 'description',
    category: 'category',
    status: 'status',
    difficulty: 'difficulty',
    contributors: 'contributors',
    requiredRoles: 'required_roles',
    deliverables: 'deliverables',
    tags: 'tags',
    max_contributors: 'max_contributors'
  },
  {
    id: 'fr',
    title: 'titre',
    description: 'description',
    category: 'categorie',
    status: 'statut',
    difficulty: 'difficulte',
    contributors: 'contributeurs',
    requiredRoles: 'roles',
    deliverables: 'livrables',
    tags: 'mots_cles',
    max_contributors: 'limite_contributeurs'
  },
  {
    id: 'hybrid',
    title: 'titre',
    description: 'description_longue',
    category: 'categorie',
    status: 'statut',
    difficulty: 'difficulte',
    contributors: 'personnes',
    requiredRoles: 'roles',
    deliverables: 'livrables',
    tags: 'mots_cles',
    max_contributors: 'limite_contributeurs'
  }
];

const statusPriority = (status: TaskStatus) => {
  const index = TASK_STATUS_ORDER.indexOf(status);
  return index === -1 ? TASK_STATUS_ORDER.length : index;
};

const detectShapeFromRow = (row: Record<string, any>): TaskTableShape => {
  let best = TABLE_SHAPES[0];
  let bestScore = -1;
  for (const shape of TABLE_SHAPES) {
    let score = 0;
    if (shape.title in row) score += 3;
    if (shape.category in row) score += 2;
    if (shape.status in row) score += 2;
    if (shape.description in row) score += 1;
    if (shape.contributors in row) score += 1;
    if (score > bestScore) {
      best = shape;
      bestScore = score;
    }
  }
  return best;
};

const normaliseArrayField = (value: unknown): string[] | undefined => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : null))
      .filter((entry): entry is string => !!entry && entry.length > 0);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return undefined;
};

const mapRowToTask = (row: Record<string, any>): Task => {
  const shape = detectShapeFromRow(row);
  const titleValue = row[shape.title];
  const descriptionValue = row[shape.description];
  const rawCategoryValue = row[shape.category];
  const statusValue = row[shape.status];
  const difficultyValue = row[shape.difficulty];
  const rawContributors = row[shape.contributors];

  const contributors: TaskContributor[] = Array.isArray(rawContributors)
    ? rawContributors
        .filter(Boolean)
        .map((entry: any) => {
          const contributorId =
            entry?.id || entry?.user_id || entry?.username || entry?.pseudo || generateLocalId();
          return {
            id: String(contributorId),
            user_id: String(entry?.user_id || entry?.id || contributorId || generateLocalId()),
            username: String(entry?.username || entry?.display_name || entry?.name || entry?.pseudo || 'Contributeur'),
            avatar_url: entry?.avatar_url || entry?.avatar || entry?.image || null,
            role: entry?.role || entry?.fonction || entry?.titre || null,
            claimed_at: entry?.claimed_at || entry?.joined_at || entry?.date || null
          } satisfies TaskContributor;
        })
    : [];

  const tags = shape.tags ? normaliseArrayField(row[shape.tags]) : undefined;
  const requiredRoles = shape.requiredRoles ? normaliseArrayField(row[shape.requiredRoles]) : undefined;
  const deliverables = shape.deliverables ? normaliseArrayField(row[shape.deliverables]) : undefined;
  const maxContributorsRaw = shape.max_contributors ? row[shape.max_contributors] : null;
  const maxContributorsNumber =
    typeof maxContributorsRaw === 'number'
      ? maxContributorsRaw
      : typeof maxContributorsRaw === 'string'
      ? Number.parseInt(maxContributorsRaw, 10)
      : null;

  return {
    id: row.id ? String(row.id) : generateLocalId(),
    title:
      typeof titleValue === 'string' && titleValue.trim().length > 0
        ? titleValue
        : 'Tâche sans titre',
    description:
      typeof descriptionValue === 'string' && descriptionValue.trim().length > 0
        ? descriptionValue
        : 'Description à compléter',
    category: normalizeTaskCategory(typeof rawCategoryValue === 'string' ? rawCategoryValue : null),
    rawCategory: typeof rawCategoryValue === 'string' ? rawCategoryValue : undefined,
    status: normalizeTaskStatus(typeof statusValue === 'string' ? statusValue : null),
    difficulty: normalizeTaskDifficulty(typeof difficultyValue === 'string' ? difficultyValue : null),
    tags,
    requiredRoles,
    deliverables,
    max_contributors: Number.isFinite(maxContributorsNumber || undefined) ? (maxContributorsNumber as number) : null,
    contributors,
    created_at: row.created_at ? String(row.created_at) : undefined,
    updated_at: row.updated_at ? String(row.updated_at) : undefined
  } satisfies Task;
};

const getShapesToTry = (preferred: TaskTableShape) => {
  const remaining = TABLE_SHAPES.filter((shape) => shape.id !== preferred.id);
  return [preferred, ...remaining];
};

const buildArrayValue = (values?: string[]) => (values ? values.filter((item) => item.trim().length > 0) : []);

const buildInsertPayload = (
  shape: TaskTableShape,
  task: CreateTaskInput,
  contributors: TaskContributor[]
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    [shape.title]: task.title,
    [shape.description]: task.description,
    [shape.category]:
      task.category === 'Autre'
        ? task.customCategory?.trim()?.length
          ? task.customCategory.trim()
          : 'Autre'
        : task.category,
    [shape.status]: task.status,
    [shape.difficulty]: task.difficulty,
    [shape.contributors]: contributors
  };

  if (shape.tags) {
    payload[shape.tags] = buildArrayValue(task.tags);
  }
  if (shape.requiredRoles) {
    payload[shape.requiredRoles] = buildArrayValue(task.requiredRoles);
  }
  if (shape.deliverables) {
    payload[shape.deliverables] = buildArrayValue(task.deliverables);
  }
  if (shape.max_contributors) {
    payload[shape.max_contributors] = task.max_contributors ?? null;
  }
  return payload;
};

const buildUpdatePayload = (
  shape: TaskTableShape,
  patch: UpdateTaskInput
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (typeof patch.title === 'string') {
    payload[shape.title] = patch.title;
  }
  if (typeof patch.description === 'string') {
    payload[shape.description] = patch.description;
  }
  if (patch.category) {
    payload[shape.category] = patch.category === 'Autre'
      ? patch.customCategory?.trim()?.length
        ? patch.customCategory.trim()
        : 'Autre'
      : patch.category;
  }
  if (patch.status) {
    payload[shape.status] = patch.status;
  }
  if (patch.difficulty) {
    payload[shape.difficulty] = patch.difficulty;
  }
  if (patch.tags) {
    if (shape.tags) {
      payload[shape.tags] = buildArrayValue(patch.tags);
    }
  }
  if (patch.requiredRoles) {
    if (shape.requiredRoles) {
      payload[shape.requiredRoles] = buildArrayValue(patch.requiredRoles);
    }
  }
  if (patch.deliverables) {
    if (shape.deliverables) {
      payload[shape.deliverables] = buildArrayValue(patch.deliverables);
    }
  }
  if (typeof patch.max_contributors !== 'undefined') {
    if (shape.max_contributors) {
      payload[shape.max_contributors] = patch.max_contributors;
    }
  }
  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) {
      delete payload[key];
    }
  });
  return payload;
};

export interface CreateTaskInput {
  title: string;
  description: string;
  category: TaskCategory;
  customCategory?: string;
  status: TaskStatus;
  difficulty: TaskDifficulty;
  tags?: string[];
  requiredRoles?: string[];
  deliverables?: string[];
  max_contributors?: number | null;
}

export type UpdateTaskInput = Partial<CreateTaskInput>;

interface UseTasksResult {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  isUsingFallback: boolean;
  createTask: (task: CreateTaskInput) => Promise<{ error?: unknown }>;
  updateTask: (id: string, patch: UpdateTaskInput) => Promise<{ error?: unknown }>;
  deleteTask: (id: string) => Promise<{ error?: unknown }>;
  claimTask: (taskId: string, contributor: TaskContributor) => Promise<{ error?: unknown }>;
  releaseTask: (taskId: string, contributorId: string) => Promise<{ error?: unknown }>;
  refreshTasks: () => Promise<void>;
}

export function useTasks(): UseTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  // Mock de données GitHub issues pour simuler plusieurs sous-repositories
  const createMockGitHubIssues = useCallback((): any[] => {
    const repositories = [
      'dying-star/frontend',
      'dying-star/backend',
      'dying-star/mobile-app',
      'dying-star/docs',
      'dying-star/design-system'
    ];

    const mockIssues = [
      // Issues du repository frontend
      {
        id: 1001,
        number: 1,
        title: 'Améliorer la performance du composant Dashboard',
        body: 'Le composant Dashboard prend trop de temps à se charger. Il faut optimiser les requêtes et le rendu.',
        state: 'open',
        labels: [
          { name: 'status:in-progress', color: '0e8a16' },
          { name: 'difficulty:medium', color: 'f29513' },
          { name: 'category:Dev', color: '0052cc' },
          { name: 'bug', color: 'd73a4a' },
          { name: 'performance', color: '7057ff' }
        ],
        assignees: [
          {
            id: 1,
            login: 'alice-dev',
            avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4'
          }
        ],
        created_at: '2024-01-15T10:30:00Z',
        updated_at: '2024-01-20T14:22:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/1',
        repository: 'dying-star/frontend'
      },
      {
        id: 1002,
        number: 2,
        title: 'Implémenter le dark mode',
        body: 'Ajouter un toggle pour basculer entre le mode clair et sombre dans toute l\'application.',
        state: 'open',
        labels: [
          { name: 'status:open', color: '0e8a16' },
          { name: 'difficulty:easy', color: '28a745' },
          { name: 'category:Dev', color: '0052cc' },
          { name: 'enhancement', color: 'a2eeef' },
          { name: 'ui/ux', color: '7057ff' }
        ],
        assignees: [
          {
            id: 6,
            login: 'frank-ui',
            avatar_url: 'https://avatars.githubusercontent.com/u/6?v=4'
          }
        ],
        created_at: '2024-01-18T09:15:00Z',
        updated_at: '2024-01-18T09:15:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/2',
        repository: 'dying-star/frontend'
      },
      // Issues du repository backend
      {
        id: 2001,
        number: 1,
        title: 'Optimiser les requêtes de base de données',
        body: 'Les requêtes SQL sont trop lentes. Analyser et optimiser les index et les jointures.',
        state: 'open',
        labels: [
          { name: 'status:in-progress', color: '0e8a16' },
          { name: 'difficulty:hard', color: 'd73a4a' },
          { name: 'category:Tech', color: '0052cc' },
          { name: 'performance', color: '7057ff' },
          { name: 'database', color: 'f9d0c4' }
        ],
        assignees: [
          {
            id: 2,
            login: 'bob-backend',
            avatar_url: 'https://avatars.githubusercontent.com/u/2?v=4'
          },
          {
            id: 3,
            login: 'charlie-dba',
            avatar_url: 'https://avatars.githubusercontent.com/u/3?v=4'
          }
        ],
        created_at: '2024-01-10T08:45:00Z',
        updated_at: '2024-01-22T16:30:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/3',
        repository: 'dying-star/backend'
      },
      {
        id: 2002,
        number: 2,
        title: 'Ajouter l\'authentification OAuth',
        body: 'Implémenter l\'authentification via Google et GitHub pour simplifier la connexion des utilisateurs.',
        state: 'open',
        labels: [
          { name: 'status:open', color: '0e8a16' },
          { name: 'difficulty:medium', color: 'f29513' },
          { name: 'category:Tech', color: '0052cc' },
          { name: 'enhancement', color: 'a2eeef' },
          { name: 'security', color: 'd73a4a' }
        ],
        assignees: [
          {
            id: 7,
            login: 'grace-auth',
            avatar_url: 'https://avatars.githubusercontent.com/u/7?v=4'
          }
        ],
        created_at: '2024-01-20T11:20:00Z',
        updated_at: '2024-01-20T11:20:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/4',
        repository: 'dying-star/backend'
      },
      // Issues du repository mobile-app
      {
        id: 3001,
        number: 1,
        title: 'Corriger le bug de synchronisation offline',
        body: 'L\'application ne synchronise pas correctement les données quand elle revient en ligne.',
        state: 'open',
        labels: [
          { name: 'status:in-progress', color: '0e8a16' },
          { name: 'difficulty:medium', color: 'f29513' },
          { name: 'category:Dev', color: '0052cc' },
          { name: 'bug', color: 'd73a4a' },
          { name: 'sync', color: '7057ff' }
        ],
        assignees: [
          {
            id: 4,
            login: 'diana-mobile',
            avatar_url: 'https://avatars.githubusercontent.com/u/4?v=4'
          }
        ],
        created_at: '2024-01-12T14:10:00Z',
        updated_at: '2024-01-21T09:45:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/5',
        repository: 'dying-star/mobile-app'
      },
      {
        id: 3002,
        number: 2,
        title: 'Améliorer l\'interface utilisateur mobile',
        body: 'Refactoriser les composants pour une meilleure expérience utilisateur sur mobile.',
        state: 'open',
        labels: [
          { name: 'status:open', color: '0e8a16' },
          { name: 'difficulty:easy', color: '28a745' },
          { name: 'category:Dev', color: '0052cc' },
          { name: 'enhancement', color: 'a2eeef' },
          { name: 'ui/ux', color: '7057ff' }
        ],
        assignees: [
          {
            id: 8,
            login: 'henry-mobile',
            avatar_url: 'https://avatars.githubusercontent.com/u/8?v=4'
          }
        ],
        created_at: '2024-01-19T16:30:00Z',
        updated_at: '2024-01-19T16:30:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/6',
        repository: 'dying-star/mobile-app'
      },
      // Issues du repository docs
      {
        id: 4001,
        number: 1,
        title: 'Mettre à jour la documentation API',
        body: 'La documentation de l\'API est obsolète. Mettre à jour tous les endpoints et exemples.',
        state: 'open',
        labels: [
          { name: 'status:open', color: '0e8a16' },
          { name: 'difficulty:easy', color: '28a745' },
          { name: 'category:Community', color: '0052cc' },
          { name: 'enhancement', color: 'a2eeef' },
          { name: 'docs', color: 'f9d0c4' }
        ],
        assignees: [
          {
            id: 9,
            login: 'iris-docs',
            avatar_url: 'https://avatars.githubusercontent.com/u/9?v=4'
          }
        ],
        created_at: '2024-01-16T13:25:00Z',
        updated_at: '2024-01-16T13:25:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/7',
        repository: 'dying-star/docs'
      },
      // Issues du repository design-system
      {
        id: 5001,
        number: 1,
        title: 'Créer un composant Button réutilisable',
        body: 'Développer un composant Button avec toutes les variantes (primary, secondary, danger, etc.).',
        state: 'open',
        labels: [
          { name: 'status:in-progress', color: '0e8a16' },
          { name: 'difficulty:easy', color: '28a745' },
          { name: 'category:Art', color: '0052cc' },
          { name: 'enhancement', color: 'a2eeef' },
          { name: 'component', color: '7057ff' }
        ],
        assignees: [
          {
            id: 5,
            login: 'eve-designer',
            avatar_url: 'https://avatars.githubusercontent.com/u/5?v=4'
          }
        ],
        created_at: '2024-01-14T10:00:00Z',
        updated_at: '2024-01-23T12:15:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/8',
        repository: 'dying-star/design-system'
      },
      {
        id: 5002,
        number: 2,
        title: 'Standardiser les couleurs du thème',
        body: 'Définir une palette de couleurs cohérente pour toute l\'application.',
        state: 'open',
        labels: [
          { name: 'status:open', color: '0e8a16' },
          { name: 'difficulty:medium', color: 'f29513' },
          { name: 'category:Art', color: '0052cc' },
          { name: 'enhancement', color: 'a2eeef' },
          { name: 'design', color: '7057ff' }
        ],
        assignees: [
          {
            id: 10,
            login: 'jack-design',
            avatar_url: 'https://avatars.githubusercontent.com/u/10?v=4'
          }
        ],
        created_at: '2024-01-17T15:40:00Z',
        updated_at: '2024-01-17T15:40:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/9',
        repository: 'dying-star/design-system'
      },
      // Issues supplémentaires pour plus de diversité
      {
        id: 6001,
        number: 1,
        title: 'Concevoir le système de progression des joueurs',
        body: 'Définir les mécaniques de progression, niveaux et récompenses pour maintenir l\'engagement des joueurs.',
        state: 'open',
        labels: [
          { name: 'status:open', color: '0e8a16' },
          { name: 'difficulty:hard', color: 'd73a4a' },
          { name: 'category:Game Design', color: '0052cc' },
          { name: 'enhancement', color: 'a2eeef' },
          { name: 'progression', color: '7057ff' }
        ],
        assignees: [
          {
            id: 11,
            login: 'kate-gamedesign',
            avatar_url: 'https://avatars.githubusercontent.com/u/11?v=4'
          }
        ],
        created_at: '2024-01-21T10:00:00Z',
        updated_at: '2024-01-21T10:00:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/10',
        repository: 'dying-star/game-design'
      },
      {
        id: 7001,
        number: 1,
        title: 'Écrire les dialogues du chapitre 3',
        body: 'Développer les dialogues et interactions pour le chapitre 3 de la campagne principale.',
        state: 'open',
        labels: [
          { name: 'status:in-progress', color: '0e8a16' },
          { name: 'difficulty:medium', color: 'f29513' },
          { name: 'category:Narrative', color: '0052cc' },
          { name: 'enhancement', color: 'a2eeef' },
          { name: 'writing', color: '7057ff' }
        ],
        assignees: [
          {
            id: 12,
            login: 'luna-writer',
            avatar_url: 'https://avatars.githubusercontent.com/u/12?v=4'
          },
          {
            id: 13,
            login: 'mike-narrative',
            avatar_url: 'https://avatars.githubusercontent.com/u/13?v=4'
          }
        ],
        created_at: '2024-01-22T14:30:00Z',
        updated_at: '2024-01-23T09:15:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/11',
        repository: 'dying-star/narrative'
      },
      {
        id: 8001,
        number: 1,
        title: 'Créer les ambiances sonores de l\'espace',
        body: 'Développer les ambiances sonores immersives pour les environnements spatiaux du jeu.',
        state: 'open',
        labels: [
          { name: 'status:open', color: '0e8a16' },
          { name: 'difficulty:medium', color: 'f29513' },
          { name: 'category:Audio', color: '0052cc' },
          { name: 'enhancement', color: 'a2eeef' },
          { name: 'sound-design', color: '7057ff' }
        ],
        assignees: [
          {
            id: 14,
            login: 'nina-audio',
            avatar_url: 'https://avatars.githubusercontent.com/u/14?v=4'
          }
        ],
        created_at: '2024-01-24T11:45:00Z',
        updated_at: '2024-01-24T11:45:00Z',
        html_url: 'https://github.com/DyingStar-game/website/issues/12',
        repository: 'dying-star/audio'
      }
    ];

    return mockIssues;
  }, []);

  const loadGithubIssues = useCallback(async (): Promise<Task[]> => {
    try {
      // Utiliser le mock au lieu de l'API réelle
      const mockIssues = createMockGitHubIssues();
      
      return mockIssues.map((issue) => ({
        id: String(issue.id),
        title: typeof issue.title === 'string' && issue.title.trim().length > 0 ? issue.title : 'Tâche sans titre',
        description:
          typeof issue.body === 'string' && issue.body.trim().length > 0
            ? issue.body
            : 'Description à compléter',
        category: normalizeTaskCategory(
          issue.labels?.find((l: any) => l.name.startsWith('category:'))?.name.split(':')[1] || null
        ),
        rawCategory: issue.labels?.find((l: any) => l.name.startsWith('category:'))?.name.split(':')[1] || undefined,
        status: normalizeTaskStatus(
          issue.labels?.find((l: any) => l.name.startsWith('status:'))?.name.split(':')[1] || null
        ),
        difficulty: normalizeTaskDifficulty(
          issue.labels?.find((l: any) => l.name.startsWith('difficulty:'))?.name.split(':')[1] || null
        ),
        tags: issue.labels?.map((l: any) => l.name).filter((name: string) => !name.includes(':')) || undefined,
        requiredRoles: undefined,
        deliverables: undefined,
        max_contributors: null,
        contributors: Array.isArray(issue.assignees)
          ? issue.assignees
              .filter(Boolean)
              .map((assignee: any) => ({
                id: String(assignee.id ?? assignee.login ?? 'gh'),
                user_id: String(assignee.id ?? assignee.login ?? 'gh'),
                username: String(assignee.login ?? 'Contributor'),
                avatar_url: assignee.avatar_url ?? null,
                role: null,
                claimed_at: null
              }))
          : [],
        created_at: issue.created_at ? String(issue.created_at) : undefined,
        updated_at: issue.updated_at ? String(issue.updated_at) : undefined,
        html_url: issue.html_url || undefined
      }));
    } catch {
      return [];
    }
  }, [createMockGitHubIssues]);

  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const statusDiff = statusPriority(a.status) - statusPriority(b.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }
      const dateA = a.created_at ?? '';
      const dateB = b.created_at ?? '';
      if (dateA !== dateB) {
        return dateA > dateB ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    });
  }, [tasks]);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const ghTasks = await loadGithubIssues();
      setTasks(ghTasks);
      setIsUsingFallback(false);
    } catch (err) {
      console.error('Erreur inattendue lors du chargement des tâches', err);
      setError('Erreur de connexion à GitHub.');
      setTasks([]);
      setIsUsingFallback(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    // Realtime disabled since tasks are loaded from GitHub only.
    return;
  }, [loadTasks]);

  const createTask = useCallback(async (_task: CreateTaskInput) => {
    // Read-only: tasks are managed on GitHub
    setError('Création désactivée: les tâches proviennent de GitHub.');
    return { error: 'read-only' };
  }, []);

  const updateTask = useCallback(async (_id: string, _patch: UpdateTaskInput) => {
    // Read-only: tasks are managed on GitHub
    setError('Mise à jour désactivée: les tâches proviennent de GitHub.');
    return { error: 'read-only' };
  }, []);

  const deleteTask = useCallback(async (_id: string) => {
    // Read-only: tasks are managed on GitHub
    setError('Suppression désactivée: les tâches proviennent de GitHub.');
    return { error: 'read-only' };
  }, []);

  const claimTask = useCallback(async (_taskId: string, _contributor: TaskContributor) => {
    // Read-only: assignments are managed on GitHub (assignees)
    setError('Attribution désactivée: utilisez les assignees GitHub.');
    return { error: 'read-only' };
  }, []);

  const releaseTask = useCallback(async (_taskId: string, _contributorId: string) => {
    // Read-only: assignments are managed on GitHub (assignees)
    setError('Libération désactivée: utilisez les assignees GitHub.');
    return { error: 'read-only' };
  }, []);

  return {
    tasks: sortedTasks,
    isLoading,
    error,
    isUsingFallback,
    createTask,
    updateTask,
    deleteTask,
    claimTask,
    releaseTask,
    refreshTasks: loadTasks
  } satisfies UseTasksResult;
}