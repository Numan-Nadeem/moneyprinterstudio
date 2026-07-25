"use client"

import useSWR from "swr"
import { listImages, saveImage, deleteImage, type GeneratedImage } from "@/lib/store/image-db"

export function useImageLibrary() {
  const { data, mutate, isLoading } = useSWR<GeneratedImage[]>("image-library", listImages, {
    fallbackData: [],
    revalidateOnFocus: false,
  })

  async function add(image: GeneratedImage) {
    await saveImage(image)
    mutate()
  }

  async function remove(id: string) {
    await deleteImage(id)
    mutate()
  }

  return { images: data ?? [], add, remove, isLoading }
}
