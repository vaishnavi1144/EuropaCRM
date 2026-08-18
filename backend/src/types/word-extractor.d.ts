declare module 'word-extractor' {
  class WordDocument { getBody(): string; }
  export default class WordExtractor { extract(source: string): Promise<WordDocument>; }
}
