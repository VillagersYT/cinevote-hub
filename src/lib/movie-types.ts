export type MoviePick = {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_year: number | null;
  runtime: number | null;
};
