import { createClient } from "@/lib/supabase/client";
import { SupabaseConfig } from "@/lib/defaults";
import { FileMetadata } from "@/types";
const supabase = createClient();

/**
 * Helper function to call the Supabase API to get the list of files in the bucket.
 * @returns {Promise<FileMetadata[]>} - A promise that resolves to an array of file metadata objects.
 */
export async function getFiles(userId: string): Promise<Array<FileMetadata>> {
    // list all folders under the userId directory in the bucket
    const { data: dirs, error } = await supabase.storage
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
        const { data, error } = await supabase.storage
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
 */
export async function deleteFile(userId: string, fileId: string) {
    // list all files in the folder
    const folderPath = `${userId}/${fileId}`;
    const { data, error: listError } = await supabase.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).list(folderPath);
    
    if (listError) {
        throw new Error(listError.message);
    }

    if (!data) return;

    // create array of file paths to delete
    const filesToDelete = data.map((file) => `${folderPath}/${file.name}`);

    // delete all files in the folder
    const { error: deleteError } = await supabase.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).remove(filesToDelete);

    if (deleteError) {
        throw new Error(deleteError.message);
    }
}

/**
 * Helper function to call the Supabase API to upload a file to the bucket.
 */
export async function uploadFile(userId: string, file: File, fileId: string): Promise<FileMetadata> {
    const filePath = `${userId}/${fileId}/${file.name}`;
    const { data: createSignedUrlData, error: createSignedUrlError } = await supabase.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).createSignedUploadUrl(filePath, {
        upsert: true,
    });

    if (createSignedUrlError) {
        throw new Error(createSignedUrlError.message);
    }
    if (!createSignedUrlData) throw new Error("Failed to create signed URL");

    const { token, path } = createSignedUrlData;
    const { error: uploadError } = await supabase.storage.from(SupabaseConfig.ATTACHMENT_BUCKET).uploadToSignedUrl(path, token, file, {
        upsert: true,
        contentType: file.type,
        metadata: {
            name: file.name,
            size: file.size.toString(),
            type: file.type,
            createdBy: userId,
        },
    });

    if (uploadError) {
        throw new Error(uploadError.message);
    }

    return {
        id: fileId,
        name: file.name,
        type: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
    };
}