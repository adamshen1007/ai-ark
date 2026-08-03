import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export class FixtureLoader {
  private readonly root: string;

  public constructor(root: string) {
    this.root = resolve(root);
  }

  public async text(path: string): Promise<string> {
    return readFile(this.resolveSafe(path), "utf8");
  }

  public async json(path: string): Promise<unknown> {
    return JSON.parse(await this.text(path));
  }

  private resolveSafe(path: string): string {
    const target = resolve(this.root, path);
    const fromRoot = relative(this.root, target);
    if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) {
      throw new Error("Fixture path escapes the configured root");
    }
    return target;
  }
}
