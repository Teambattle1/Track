import { supabase } from '../lib/supabase';
import { MediaSubmission } from '../types';

const STORAGE_BUCKET = 'game-assets';

/**
 * Upload a photo or video file to Supabase Storage
 * @param file - The file to upload (photo or video)
 * @param gameId - The game ID
 * @param teamId - The team ID
 * @returns The public URL of the uploaded file
 */
export const uploadMediaFile = async (
  file: File | Blob,
  gameId: string,
  teamId: string
): Promise<string> => {
  try {
    const timestamp = Date.now();
    const fileExt = file instanceof File ? file.name.split('.').pop() : 'jpg';
    const fileName = `${gameId}/${teamId}/${timestamp}.${fileExt}`;

    console.log('[Media Upload] Uploading file:', fileName, 'Size:', file.size);

    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('[Media Upload] Upload failed:', error);
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(data.path);

    console.log('[Media Upload] Upload successful:', urlData.publicUrl);
    return urlData.publicUrl;
  } catch (error) {
    console.error('[Media Upload] Error:', error);
    throw error;
  }
};

/**
 * Create a media submission record in the database
 */
export const createMediaSubmission = async (
  gameId: string,
  teamId: string,
  teamName: string,
  pointId: string,
  pointTitle: string,
  mediaUrl: string,
  mediaType: 'photo' | 'video'
): Promise<MediaSubmission> => {
  try {
    const submission: Omit<MediaSubmission, 'id'> = {
      gameId,
      teamId,
      teamName,
      pointId,
      pointTitle,
      mediaUrl,
      mediaType,
      submittedAt: Date.now(),
      status: 'pending'
    };

    const { data, error } = await supabase
      .from('media_submissions')
      .insert([submission])
      .select()
      .single();

    if (error) {
      console.error('[Media Submission] Insert failed:', error);
      throw new Error(`Failed to create submission: ${error.message}`);
    }

    console.log('[Media Submission] Created:', data);
    return data as MediaSubmission;
  } catch (error) {
    console.error('[Media Submission] Error:', error);
    throw error;
  }
};

/**
 * Get pending media submissions for a game
 */
export const getPendingSubmissions = async (gameId: string): Promise<MediaSubmission[]> => {
  try {
    const { data, error } = await supabase
      .from('media_submissions')
      .select('*')
      .eq('game_id', gameId)
      .eq('status', 'pending')
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('[Media Submissions] Fetch failed:', error);
      return [];
    }

    return data as MediaSubmission[];
  } catch (error) {
    console.error('[Media Submissions] Error:', error);
    return [];
  }
};

/**
 * Approve a media submission (with optional partial score)
 */
export const approveMediaSubmission = async (
  submissionId: string,
  reviewedBy: string,
  partialScore?: number
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('media_submissions')
      .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: Date.now(),
        partial_score: partialScore
      })
      .eq('id', submissionId);

    if (error) {
      console.error('[Media Approval] Update failed:', error);
      throw new Error(`Failed to approve: ${error.message}`);
    }

    console.log('[Media Approval] Approved:', submissionId, partialScore ? `(${partialScore}%)` : '(100%)');
  } catch (error) {
    console.error('[Media Approval] Error:', error);
    throw error;
  }
};

/**
 * Reject a media submission and delete the file
 */
export const rejectMediaSubmission = async (
  submissionId: string,
  reviewedBy: string,
  reviewComment: string,
  mediaUrl: string
): Promise<void> => {
  try {
    // Update the submission status
    const { error: updateError } = await supabase
      .from('media_submissions')
      .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: Date.now(),
        review_comment: reviewComment
      })
      .eq('id', submissionId);

    if (updateError) {
      console.error('[Media Rejection] Update failed:', updateError);
      throw new Error(`Failed to reject: ${updateError.message}`);
    }

    // Delete the file from storage
    try {
      const filePath = mediaUrl.split(`${STORAGE_BUCKET}/`)[1];
      if (filePath) {
        const { error: deleteError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .remove([filePath]);

        if (deleteError) {
          console.warn('[Media Rejection] File deletion failed:', deleteError);
          // Don't throw - rejection is still valid even if file deletion fails
        } else {
          console.log('[Media Rejection] File deleted:', filePath);
        }
      }
    } catch (deleteError) {
      console.warn('[Media Rejection] File deletion error:', deleteError);
    }

    console.log('[Media Rejection] Rejected:', submissionId);
  } catch (error) {
    console.error('[Media Rejection] Error:', error);
    throw error;
  }
};

/**
 * Subscribe to media submission changes for a game
 */
export const subscribeToMediaSubmissions = (
  gameId: string,
  callback: (submission: MediaSubmission) => void
) => {
  const channel = supabase
    .channel(`media_submissions:${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'media_submissions',
        filter: `game_id=eq.${gameId}`
      },
      (payload) => {
        console.log('[Media Realtime] New submission:', payload.new);
        callback(payload.new as MediaSubmission);
      }
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
};

/**
 * Delete media files older than a specific date
 */
export const deleteMediaOlderThan = async (
  gameId: string | 'all',
  beforeDate: Date
): Promise<{ deletedCount: number; errors: string[] }> => {
  try {
    const beforeTimestamp = beforeDate.getTime();
    
    // Query submissions
    let query = supabase
      .from('media_submissions')
      .select('*')
      .lt('submitted_at', beforeTimestamp);

    if (gameId !== 'all') {
      query = query.eq('game_id', gameId);
    }

    const { data: submissions, error } = await query;

    if (error) {
      console.error('[Media Delete] Query failed:', error);
      throw new Error(`Failed to query media: ${error.message}`);
    }

    const errors: string[] = [];
    let deletedCount = 0;

    // Delete files from storage and records from database
    for (const submission of submissions || []) {
      try {
        // Delete file from storage
        const filePath = submission.media_url.split(`${STORAGE_BUCKET}/`)[1];
        if (filePath) {
          await supabase.storage.from(STORAGE_BUCKET).remove([filePath]);
        }

        // Delete record from database
        await supabase.from('media_submissions').delete().eq('id', submission.id);

        deletedCount++;
      } catch (err: any) {
        errors.push(`Failed to delete ${submission.id}: ${err.message}`);
      }
    }

    console.log(`[Media Delete] Deleted ${deletedCount} items, ${errors.length} errors`);
    return { deletedCount, errors };
  } catch (error: any) {
    console.error('[Media Delete] Error:', error);
    throw error;
  }
};

/**
 * Get media statistics for all games
 */
export const getMediaStats = async (games: { id: string; name: string }[]) => {
  try {
    const stats = await Promise.all(
      games.map(async (game) => {
        // Try to query media_type first to check if table exists
        const { data, error } = await supabase
          .from('media_submissions')
          .select('media_type')
          .eq('game_id', game.id);

        // If table doesn't exist or query failed, return empty stats
        if (error) {
          // Table might not exist yet - SQL script not run
          if (error.code === '42P01' || error.code === '42703') {
            // 42P01 = table does not exist, 42703 = column does not exist
            // Silently return empty stats (user needs to run SQL script)
            return {
              gameId: game.id,
              gameName: game.name,
              photoCount: 0,
              videoCount: 0,
              totalSizeMB: 0,
              downloadedCount: 0
            };
          }
          console.error('[Media Stats] Query failed for game:', game.id, error);
          return {
            gameId: game.id,
            gameName: game.name,
            photoCount: 0,
            videoCount: 0,
            totalSizeMB: 0,
            downloadedCount: 0
          };
        }

        const photoCount = data.filter((s) => s.media_type === 'photo').length;
        const videoCount = data.filter((s) => s.media_type === 'video').length;

        // downloaded_by_client might not exist yet - gracefully handle
        const downloadedCount = 0; // Will be 0 until SQL script is run

        // Estimate size (we don't track actual file sizes in the DB for simplicity)
        // Average: 2MB per photo, 10MB per video
        const totalSizeMB = photoCount * 2 + videoCount * 10;

        return {
          gameId: game.id,
          gameName: game.name,
          photoCount,
          videoCount,
          totalSizeMB,
          downloadedCount
        };
      })
    );

    return stats;
  } catch (error) {
    console.error('[Media Stats] Error:', error);
    return [];
  }
};
