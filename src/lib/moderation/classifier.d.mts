export interface ModerationClassification {
  status: 'flagged' | 'clear';
  score: number;
  modelVersion: string;
  evaluatedAt: Date;
}

export function classifyStory(title: unknown, body: unknown): Promise<ModerationClassification>;
export const moderationModelInfo: Readonly<{ version: string; algorithm: string; threshold: number }>;
