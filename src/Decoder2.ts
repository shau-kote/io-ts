/**
 * @since 2.2.7
 */
import * as E from 'fp-ts/lib/Either'
import * as DE from './DecodeError'
import * as DT from './DecoderT'
import * as FS from '../src/FreeSemigroup'
import * as G from './Guard'
import * as NEA from 'fp-ts/lib/NonEmptyArray'
import * as T from 'fp-ts/lib/Tree'
import { Literal } from './Schemable'

const M = E.getValidation(DE.getSemigroup<string>())

// -------------------------------------------------------------------------------------
// model
// -------------------------------------------------------------------------------------

/**
 * @category model
 * @since 2.2.7
 */
export interface Decoder<A> {
  readonly decode: (u: unknown) => E.Either<DecodeError, A>
}

// -------------------------------------------------------------------------------------
// DecodeError
// -------------------------------------------------------------------------------------

/**
 * @category DecodeError
 * @since 2.2.7
 */
export type DecodeError = FS.FreeSemigroup<DE.DecodeError<string>>

/**
 * @category DecodeError
 * @since 2.2.7
 */
export function success<A>(a: A): E.Either<DecodeError, A> {
  return E.right(a)
}

/**
 * @category DecodeError
 * @since 2.2.7
 */
export function failure<A = never>(actual: unknown, message: string): E.Either<DecodeError, A> {
  return E.left(FS.of(DE.leaf(actual, message)))
}

// -------------------------------------------------------------------------------------
// constructors
// -------------------------------------------------------------------------------------

/**
 * @category constructors
 * @since 2.2.7
 */
export const fromGuard = <A>(guard: G.Guard<A>, expected: string): Decoder<A> => ({
  decode: (u) => (guard.is(u) ? success(u) : failure(u, expected))
})

/**
 * @category constructors
 * @since 2.2.7
 */
export const literal = <A extends readonly [Literal, ...Array<Literal>]>(...values: A): Decoder<A[number]> =>
  fromGuard(G.literal(...values), values.map((value) => JSON.stringify(value)).join(' | '))

// -------------------------------------------------------------------------------------
// primitives
// -------------------------------------------------------------------------------------

/**
 * @category primitives
 * @since 2.2.7
 */
export const never: Decoder<never> = fromGuard(G.never, 'never')

/**
 * @category primitives
 * @since 2.2.7
 */
export const string: Decoder<string> = fromGuard(G.string, 'string')

/**
 * @category primitives
 * @since 2.2.7
 */
export const number: Decoder<number> = fromGuard(G.number, 'number')

/**
 * @category primitives
 * @since 2.2.7
 */
export const boolean: Decoder<boolean> = fromGuard(G.boolean, 'boolean')

/**
 * @category primitives
 * @since 2.2.7
 */
export const UnknownArray: Decoder<Array<unknown>> = fromGuard(G.UnknownArray, 'Array<unknown>')

/**
 * @category primitives
 * @since 2.2.7
 */
export const UnknownRecord: Decoder<Record<string, unknown>> = fromGuard(G.UnknownRecord, 'Record<string, unknown>')

// -------------------------------------------------------------------------------------
// combinators
// -------------------------------------------------------------------------------------

// TODO
/**
 * @category combinators
 * @since 2.2.0
 */
// export function nullable<A>(or: Decoder<A>): Decoder<null | A> {
//   return union(literal(null), or)
// }

/**
 * @category combinators
 * @since 2.2.7
 */
export const type: <A>(properties: { [K in keyof A]: Decoder<A[K]> }) => Decoder<{ [K in keyof A]: A[K] }> = DT.type(
  M
)(UnknownRecord, (k, e) => FS.of(DE.key(k, DE.required, e)))

/**
 * @category combinators
 * @since 2.2.7
 */
export const partial: <A>(
  properties: { [K in keyof A]: Decoder<A[K]> }
) => Decoder<Partial<{ [K in keyof A]: A[K] }>> = DT.partial(M)(UnknownRecord, (k, e) =>
  FS.of(DE.key(k, DE.optional, e))
)

/**
 * @category combinators
 * @since 2.2.7
 */
export const array: <A>(items: Decoder<A>) => Decoder<Array<A>> = DT.array(M)(UnknownArray, (i, e) =>
  FS.of(DE.index(i, DE.optional, e))
)

/**
 * @category combinators
 * @since 2.2.7
 */
export const record: <A>(codomain: Decoder<A>) => Decoder<Record<string, A>> = DT.record(M)(UnknownRecord, (k, e) =>
  FS.of(DE.key(k, DE.optional, e))
)

/**
 * @category combinators
 * @since 2.2.7
 */
export const tuple: <A extends ReadonlyArray<unknown>>(
  ...components: { [K in keyof A]: Decoder<A[K]> }
) => Decoder<A> = DT.tuple(M)(UnknownArray, (i, e) => FS.of(DE.index(i, DE.required, e))) as any

// -------------------------------------------------------------------------------------
// utils
// -------------------------------------------------------------------------------------

const toForest = (e: DecodeError): NEA.NonEmptyArray<T.Tree<string>> => {
  const toTree: (e: DE.DecodeError<string>) => T.Tree<string> = DE.fold({
    Leaf: (input, error) => T.make(`cannot decode ${JSON.stringify(input)}, should be ${error}`),
    Key: (key, kind, errors) => T.make(`${kind} property ${JSON.stringify(key)}`, toForest(errors)),
    Index: (index, kind, errors) => T.make(`${kind} index ${index}`, toForest(errors))
  })
  const toForest: (f: DecodeError) => NEA.NonEmptyArray<T.Tree<string>> = FS.fold(
    (value) => [toTree(value)],
    (left, right) => NEA.concat(toForest(left), toForest(right))
  )
  return toForest(e)
}

/**
 * @since 2.2.7
 */
export const draw = (e: DecodeError): string => toForest(e).map(T.drawTree).join('\n')