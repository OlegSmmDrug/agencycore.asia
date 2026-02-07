export interface BriefMessage {
  role: 'user' | 'model';
  content: string;
}

export interface BriefState {
  progress: number;
  status: string;
  isComplete: boolean;
  finalData: any | null;
}

export interface BriefSession {
  id: string;
  organizationId: string;
  userId: string;
  clientId: string | null;
  title: string;
  messages: BriefMessage[];
  briefData: any | null;
  progress: number;
  status: string;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
}
