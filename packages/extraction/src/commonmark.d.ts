declare module "commonmark" {
  export interface NodeWalkingStep {
    readonly entering: boolean;
    readonly node: Node;
  }

  export interface NodeWalker {
    next(): NodeWalkingStep | null;
  }

  export class Node {
    readonly type: string;
    readonly firstChild: Node | null;
    readonly next: Node | null;
    readonly sourcepos: readonly [readonly [number, number], readonly [number, number]] | null;
    readonly literal: string | null;
    readonly destination: string | null;
    readonly level: number | null;
    readonly info: string | null;
    walker(): NodeWalker;
  }

  export class Parser {
    parse(input: string): Node;
  }
}
