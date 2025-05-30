import { supabaseClient } from "@/lib/supabase/client";
import { SupabaseConfig } from "@/lib/defaults";
import { DocumentSummary, FileMetadata } from "@/types";
import { restClient } from "@/lib/backend/index";

/**
 * Helper function to call the Supabase API to get the list of files in the bucket.
 * @param {string} userId - The user ID to get files for.
 * @returns {Promise<FileMetadata[]>} - A promise that resolves to an array of file metadata objects.
 */
export async function getFiles(userId: string): Promise<Array<FileMetadata>> {
    // list all folders under the userId directory in the bucket
    const { data: dirs, error } = await supabaseClient.storage
        .from(SupabaseConfig.ATTACHMENT_BUCKET)
        .list(userId);
    
    if (error) {
        throw new Error(error.message);
    }

    if (!dirs) return new Array<FileMetadata>();

    // filter out .emptyFolderPlaceholder
    const filteredData = dirs.filter(
        (folder) => folder.name !== ".emptyFolderPlaceholder"
    );

    const fileMetadataList = new Array<FileMetadata>();
    for (const folder of filteredData) {
        // get the content inside the folder
        const { data, error } = await supabaseClient.storage
            .from(SupabaseConfig.ATTACHMENT_BUCKET)
            .list(`${userId}/${folder.name}`);

        if (error) {
            throw new Error(error.message);
        }

        if (!data) continue;

        // there should be only one pdf file and we will use that to display the file
        const pdfFile = data.find((file) => file.name.endsWith(".pdf"));
        if (pdfFile) {
            fileMetadataList.push({
                id: folder.name,
                name: pdfFile.name,
                type: pdfFile.metadata.mimetype,
                size: pdfFile.metadata.size,
                createdAt: pdfFile.created_at,
            });
        }

        // ordered by the created_at date ascending
        fileMetadataList.sort((a, b) => {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        });
    }
    return fileMetadataList;
}

/**
 * Helper function to call the Supabase API to delete a file from the bucket.
 * @param {string} userId - The user ID to delete files for.
 * @param {string} fileId - The file ID to delete.
 */
export async function deleteFile(userId: string, fileId: string) {
    // list all files in the folder
    const folderPath = `${userId}/${fileId}`;
    const { data, error: listError } = await supabaseClient.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).list(folderPath);
    
    if (listError) {
        throw new Error(listError.message);
    }

    if (!data) return;

    // create array of file paths to delete
    const filesToDelete = data.map((file) => `${folderPath}/${file.name}`);

    // delete all files in the folder
    const { error: deleteError } = await supabaseClient.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).remove(filesToDelete);

    if (deleteError) {
        throw new Error(deleteError.message);
    }

    // delete the folder
    const { error: deleteFolderError } = await supabaseClient.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).remove([folderPath]);

    if (deleteFolderError) {
        throw new Error(deleteFolderError.message);
    }

    return {
        success: true,
    }
}

// /**
//  * Helper function to call the Supabase API to upload a file to the bucket.
//  * @param {string} userId - The user ID to upload files for.
//  * @param {File} file - The file to upload.
//  * @param {string} fileId - The file ID to upload.
//  */
// export async function uploadFile(userId: string, file: File, fileId: string): Promise<FileMetadata> {
//     const filePath = `${userId}/${fileId}/${file.name}`;
//     const { data: createSignedUrlData, error: createSignedUrlError } = await supabaseClient.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).createSignedUploadUrl(filePath, {
//         upsert: true,
//     });

//     if (createSignedUrlError) {
//         throw new Error(createSignedUrlError.message);
//     }
//     if (!createSignedUrlData) throw new Error("Failed to create signed URL");

//     const { token, path } = createSignedUrlData;
//     const { error: uploadError } = await supabaseClient.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).uploadToSignedUrl(path, token, file, {
//         upsert: true,
//         contentType: file.type,
//         metadata: {
//             name: file.name,
//             size: file.size.toString(),
//             type: file.type,
//             createdBy: userId,
//         },
//     });

//     if (uploadError) {
//         throw new Error(uploadError.message);
//     }

//     return {
//         id: fileId,
//         name: file.name,
//         type: file.type,
//         size: file.size,
//         createdAt: new Date().toISOString(),
//     };
// }

type FileUploadResponse = {
    id: string;
    task_id: string;
}

export async function uploadFile(fileId: string, file: File): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append("file_id", fileId);
    formData.append("file", file);

    const response = await restClient.fetch(`/files/upload`, {
        method: "POST",
        body: formData,
    });

    if (!response.ok) {
        throw new Error("Failed to upload file");
    }

    return response.json();
}


/** Summarization Endpoints*/

/**
 * Helper function to call the FastAPI backend to summarize a file.
 * @param {string} fileId - The ID of the file to summarize.
 * @returns {Promise<DocumentSummary>} - A promise that resolves to a document summary object.
 */
export async function summarizeFile(fileId: string) {
    const response = await restClient.fetch(`/files/${fileId}/summarize`, {
        method: "POST",
    })
    if (!response.ok) {
        throw new Error("Failed to summarize file");
    }

    return response.json();
}

/**
 * Helper function to call the FastAPI backend to get the summary of a file.
 * @param {string} fileId - The ID of the file to get the summary for.
 * @returns {Promise<DocumentSummary>} - A promise that resolves to a document summary object.
 */
export async function getSummary(fileId: string) {
    const response = await restClient.fetch(`/files/${fileId}/summary`)
    if (!response.ok) {
        throw new Error("Failed to get summary");
    }

    // we need to download the file from the url and return the file
    const data = await response.json();
    const downloadUrl = data.downloadUrl;

    const downloadResponse = await fetch(downloadUrl);
    if (!downloadResponse.ok) {
        throw new Error("Failed to download summary");
    }

    const summaryJson = await downloadResponse.json();

    return {
        id: fileId,
        summary: summaryJson.content,
    }
}

/**
 * Helper function to track task status using Server-Sent Events (SSE).
 * @param {string} taskId - The ID of the task to track.
 * @param {(data: any) => void} onUpdate - Callback function that will be called with each status update.
 * @returns {() => void} - A function to close the SSE connection.
 */
export function trackTaskStatus(
    taskId: string,
    onUpdate: (data: any) => void
): () => void {
    const eventSource = new EventSource(
        `${restClient.baseUrl}/files/sse/tasks/${taskId}`
    );

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            onUpdate(data);

            // Auto-close the connection when the task is complete
            if (
                data.status === "SUCCESS" ||
                data.status === "FAILURE" ||
                data.status === "REVOKED"
            ) {
                eventSource.close();
            }
        } catch (error) {
            console.error("Error parsing SSE message:", error);
        }
    };

    eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        eventSource.close();
        onUpdate({ error: "Connection error", taskId });
    };

    // Return a function to manually close the connection
    return () => {
        eventSource.close();
    };
}


