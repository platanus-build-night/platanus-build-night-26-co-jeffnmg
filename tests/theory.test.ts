import { describe, expect, it } from "vitest";

import {
  chordCatalog,
  detectChords,
  detectScales,
  keyNotes,
  midiToName,
  nameToMidi,
  scaleCatalog,
} from "@/modules/composer/model/theory";

describe("detectChords", () => {
  it("detecta C mayor exacto (score 1)", () => {
    const matches = detectChords([60, 64, 67]); // C4 E4 G4
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].score).toBe(1);
    expect(matches[0].symbol).toMatch(/^C/);
    expect(matches[0].missing).toEqual([]);
    expect(matches[0].extra).toEqual([]);
  });

  it("detecta Cmaj7", () => {
    const matches = detectChords([60, 64, 67, 71]); // C E G B
    expect(matches.some((m) => m.symbol.includes("maj7") && m.score === 1)).toBe(
      true
    );
  });

  it("detecta A menor", () => {
    const matches = detectChords([57, 60, 64]); // A3 C4 E4
    expect(matches[0].score).toBe(1);
    expect(matches[0].symbol).toMatch(/^A/);
  });

  it("sugiere coincidencias parciales con notas faltantes", () => {
    const matches = detectChords([60, 64]); // C E — falta la quinta
    const partial = matches.find((m) => m.score < 1 && m.missing.length > 0);
    expect(partial).toBeDefined();
  });

  it("respeta el límite y ordena por puntaje", () => {
    const matches = detectChords([60, 64, 67], 3);
    expect(matches.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  it("vacío para entrada vacía", () => {
    expect(detectChords([])).toEqual([]);
  });
});

describe("detectScales", () => {
  it("la escala mayor de C contiene todas las notas de C mayor", () => {
    const matches = detectScales([60, 62, 64, 65, 67, 69, 71]);
    expect(
      matches.some((m) => m.name === "major" && m.tonic === "C")
    ).toBe(true);
  });

  it("solo devuelve escalas que contienen TODAS las notas", () => {
    const matches = detectScales([60, 61]); // C y C#
    for (const m of matches) {
      expect(m.notes).toContain("C");
      expect(m.notes).toContain("C#");
    }
  });

  it("vacío para entrada vacía", () => {
    expect(detectScales([])).toEqual([]);
  });
});

describe("catálogos", () => {
  it("chordCatalog incluye la tríada mayor con sus notas", () => {
    const catalog = chordCatalog("C");
    const major = catalog.find((c) => c.notes.join(",") === "C,E,G");
    expect(major).toBeDefined();
  });

  it("scaleCatalog incluye la escala mayor", () => {
    const catalog = scaleCatalog("C");
    const major = catalog.find((s) => s.name === "major");
    expect(major?.notes).toEqual(["C", "D", "E", "F", "G", "A", "B"]);
  });
});

describe("conversiones y tonalidad", () => {
  it("midiToName / nameToMidi", () => {
    expect(midiToName(60)).toBe("C4");
    expect(nameToMidi("A4")).toBe(69);
    expect(nameToMidi("nota-invalida")).toBeNull();
  });

  it("keyNotes de C major = notas naturales", () => {
    expect([...keyNotes("C major")].sort((a, b) => a - b)).toEqual([
      0, 2, 4, 5, 7, 9, 11,
    ]);
  });

  it("A minor tiene las mismas notas que C major", () => {
    expect(keyNotes("A minor")).toEqual(keyNotes("C major"));
  });

  it("tonalidad inválida devuelve set vacío", () => {
    expect(keyNotes("X??").size).toBe(0);
  });
});
