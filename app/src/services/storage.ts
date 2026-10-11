import { supabase } from '@/lib/supabase'

export async function uploadPrivateFile(bucket: string, path: string, file: File) {
  const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
  if (error) throw new Error(error.message)
  return path
}

export async function createPrivateDownloadUrl(bucket: string, path: string, expiresIn = 300) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresIn)
  if (error) throw new Error(error.message)
  return data.signedUrl
}
