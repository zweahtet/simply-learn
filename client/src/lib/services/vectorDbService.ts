import { QdrantClient } from '@qdrant/js-client-rest';
import { generateDenseVectorEmbeddings, generateSparseVectorEmbeddings, generateLateIterationVectorEmbeddings } from './embeddingService';

const YOUTUBE_COLLECTION_NAME = 'youtube_videos';
const ATTACHMENT_COLLECTION_NAME = 'attachments';

class VectorSpace {
    public qdrantClient: QdrantClient;
    public qdrantCollectionName: string;

    constructor(collectionName: string) {
        this.qdrantClient = new QdrantClient({
            url: process.env.QDRANT_URL,
            apiKey: process.env.QDRANT_API_KEY
        });
        this.qdrantCollectionName = collectionName;
    }

    // check if the collection exists
    async checkCollectionExists() {
        const response = await this.qdrantClient.collectionExists(this.qdrantCollectionName);
        return response.exists;
    }
}

class YouTubeVectorSpace extends VectorSpace {

    constructor() {
        super(YOUTUBE_COLLECTION_NAME);
    }

    async recommend(query: string, topK: number = 5) {
        // generate embeddings for the query
        const denseVector = await generateDenseVectorEmbeddings(query);
        const sparseVector = await generateSparseVectorEmbeddings(query);
        const lateIterationVector = await generateLateIterationVectorEmbeddings(query);

        // setup prefetch queries
        const prefetch = [
            {
                query: denseVector,
                using: "dense",
                limit: 20
            }, 
            {
                query: sparseVector,
                using: "sparse",
                limit: 20
            }
        ]

        const reponse = await this.qdrantClient.query(
            this.qdrantCollectionName,
            {
                prefetch: prefetch,
            }
        )
    }
} 


class AttachmentVectorSpace extends VectorSpace {
    constructor() {
        super(ATTACHMENT_COLLECTION_NAME);
    }


}

export const youtubeVectorSpace = new YouTubeVectorSpace();
export const attachmentVectorSpace = new AttachmentVectorSpace();