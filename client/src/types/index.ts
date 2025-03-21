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