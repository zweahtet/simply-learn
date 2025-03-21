// client/src/types/index.ts
export interface FileMetadata {
    fileId: string;
    filename: string;
    title: string;
    totalPages: number;
    isComplete?: boolean;
}

export interface CognitiveLevel {
    attention: number;
    memory: number;
    language: number;
    visuospatial: number;
    reasoning: number;
}