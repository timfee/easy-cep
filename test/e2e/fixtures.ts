import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(__dirname, "fixtures");

const readJsonFile = (filePath: string) =>
  JSON.parse(fs.readFileSync(filePath, "utf8"));

const writeJsonFile = (filePath: string, value: unknown) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

export const shouldUpdateFixtures = () => process.env.UPDATE_FIXTURES === "1";
export const shouldCheckFixtures = () => process.env.CHECK_FIXTURES === "1";

export const getFixturePath = (name: string) =>
  path.join(fixturesDir, `${name}.json`);

export const loadFixture = (name: string) => {
  const filePath = getFixturePath(name);
  return readJsonFile(filePath);
};

export const saveFixture = (name: string, data: unknown) => {
  const filePath = getFixturePath(name);
  writeJsonFile(filePath, data);
};

const isDeepEqual = (left: unknown, right: unknown) =>
  JSON.stringify(left) === JSON.stringify(right);

export const assertFixture = (name: string, value: unknown) => {
  const filePath = getFixturePath(name);

  if (shouldUpdateFixtures()) {
    saveFixture(name, value);
    return;
  }

  if (shouldCheckFixtures()) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Missing fixture: ${filePath}`);
    }
    const expected = loadFixture(name);
    if (!isDeepEqual(expected, value)) {
      throw new Error(`Fixture mismatch: ${name}`);
    }
  }
};
