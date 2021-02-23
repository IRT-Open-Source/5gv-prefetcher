export class StreamInfoDto {
  id: string;
  title: string;
  synopsis: string;
  availableTo: string;
  image: {
    alt: string;
    src: string;
    title: string;
  };
  streamUrls: string[];
}
