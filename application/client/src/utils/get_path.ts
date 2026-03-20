const CACHE_BUSTER = "v=3";

export function getImagePath(imageId: string): string {
  return `/images/${imageId}.webp?${CACHE_BUSTER}`;
}

export function getMoviePath(movieId: string): string {
  return `/movies/${movieId}.mp4?${CACHE_BUSTER}`;
}

export function getSoundPath(soundId: string): string {
  return `/sounds/${soundId}.mp3?${CACHE_BUSTER}`;
}

export function getProfileImagePath(profileImageId: string): string {
  return `/images/profiles/${profileImageId}.webp?${CACHE_BUSTER}`;
}
