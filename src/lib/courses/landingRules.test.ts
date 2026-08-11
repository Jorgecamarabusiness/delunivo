import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  shouldShowCoursesNav,
  splitForLanding,
  LANDING_COURSE_LIMIT,
  type LandingCourse,
} from "./landingRules.ts";

function curso(id: string): LandingCourse {
  return {
    id,
    title: `Curso ${id}`,
    price: 49,
    thumbnailUrl: null,
    shortDescription: null,
  };
}

describe("shouldShowCoursesNav — cuándo sale el enlace 'Cursos' del header", () => {
  test("con 1 curso NO sale: la portada ya lo enseña", () => {
    assert.equal(shouldShowCoursesNav(1), false);
  });

  test("con 4 cursos TAMPOCO sale: la portada enseña exactamente esos 4", () => {
    assert.equal(shouldShowCoursesNav(LANDING_COURSE_LIMIT), false);
  });

  test("con 5 cursos SÍ sale: hay uno que la portada no enseña", () => {
    assert.equal(shouldShowCoursesNav(LANDING_COURSE_LIMIT + 1), true);
  });

  test("sin cursos no sale", () => {
    assert.equal(shouldShowCoursesNav(0), false);
  });
});

describe("splitForLanding — qué cursos van a la portada", () => {
  test("sin cursos no hay destacado ni resto", () => {
    const resultado = splitForLanding([], null);
    assert.equal(resultado.featured, null);
    assert.deepEqual(resultado.rest, []);
    assert.equal(resultado.hasMore, false);
  });

  test("sin curso destacado elegido, se usa el más antiguo (el primero)", () => {
    const resultado = splitForLanding([curso("a"), curso("b")], null);
    assert.equal(resultado.featured?.id, "a");
  });

  test("respeta el curso destacado que eligió el admin", () => {
    const resultado = splitForLanding([curso("a"), curso("b"), curso("c")], "b");
    assert.equal(resultado.featured?.id, "b");
  });

  test("el destacado nunca se repite abajo", () => {
    const resultado = splitForLanding([curso("a"), curso("b"), curso("c")], "b");
    assert.deepEqual(
      resultado.rest.map((c) => c.id),
      ["a", "c"]
    );
  });

  test("la portada enseña como mucho 4 cursos: el destacado + 3", () => {
    const seis = ["a", "b", "c", "d", "e", "f"].map(curso);
    const resultado = splitForLanding(seis, null);
    assert.equal(resultado.rest.length, LANDING_COURSE_LIMIT - 1);
    assert.equal(1 + resultado.rest.length, LANDING_COURSE_LIMIT);
  });

  test("con 6 cursos avisa de que hay más (hasMore)", () => {
    const seis = ["a", "b", "c", "d", "e", "f"].map(curso);
    assert.equal(splitForLanding(seis, null).hasMore, true);
  });

  test("con 4 cursos NO avisa de que hay más: están todos en la portada", () => {
    const cuatro = ["a", "b", "c", "d"].map(curso);
    assert.equal(splitForLanding(cuatro, null).hasMore, false);
  });

  test("si el curso destacado ya no existe, cae al más antiguo en vez de quedarse vacío", () => {
    const resultado = splitForLanding([curso("a"), curso("b")], "borrado");
    assert.equal(resultado.featured?.id, "a");
  });
});
