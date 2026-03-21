declare module "negaposi-analyzer-ja" {
  function analyze(tokens: Array<{ word_type?: string; surface_form?: string }>): number;
  export default analyze;
}
