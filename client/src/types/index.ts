// client/src/types/index.ts
export interface FileMetadata {
    fileId: string;
    filename: string;
    title: string;
    totalPages: number;
    isComplete?: boolean;
}

export interface CognitiveProfile {
    attention: number;
    memory: number;
    language: number;
    visuospatial: number;
    executive: number;
}

export interface UserProfile {
    id?: string;
    email?: string;
    languageLevel: string;
    cognitiveProfile: CognitiveProfile;
    completedAssessment: boolean;
}

// Define assessment sections
export interface AssessmentQuestion {
    id: string;
    type: "choice" | "text" | "memory" | "visuospatial" | "sequencing";
    question: string;
    choices?: string[];
    correctAnswer?: string;
    instructions?: string;
    points: number;
    timerSeconds?: number; // Add timer property to questions
}

export interface AssessmentSection {
    id: string;
    title: string;
    description: string;
    questions: AssessmentQuestion[];
}

export interface AssessmentResultsSummary {
    languageLevel: string;
    cognitiveProfile: CognitiveProfile;
    overallScore: number;
}
