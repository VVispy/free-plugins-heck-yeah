import { instead } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { cloneElement, isValidElement } from 'react'
import type { ElementType, FC, ReactElement, ReactNode } from 'react'

type JSXFactory = (type: unknown, props: unknown, key?: unknown) => unknown

/**
 * Returns the name of a function, memo or forwardRef component.
 */
export function componentName(type: unknown): string | undefined {
	if (typeof type === 'function') return type.name
	if (typeof type !== 'object' || type === null) return

	const inner =
		(type as { type?: unknown; render?: unknown }).type ??
		(type as { render?: unknown }).render
	return typeof inner === 'function' ? inner.name : componentName(inner)
}

const waiting = new Map<string, Set<(type: ElementType) => void>>()
let unpatchJSX: (() => void) | undefined

/**
 * Calls `callback` with the first element type named `name` that gets rendered.
 * Used for components that no module exports.
 *
 * @returns A function to stop waiting.
 */
export function onComponentType(
	name: string,
	callback: (type: ElementType) => void,
) {
	let callbacks = waiting.get(name)
	if (!callbacks) waiting.set(name, (callbacks = new Set()))
	callbacks.add(callback)
	unpatchJSX ??= patchJSX()

	return () => {
		callbacks.delete(callback)
		if (!callbacks.size) waiting.delete(name)
		if (!waiting.size) stopJSX()
	}
}

function patchJSX() {
	const runtime = ReactJSXRuntime as unknown as Record<
		'jsx' | 'jsxs',
		JSXFactory
	>

	const hook = function (
		this: unknown,
		args: Parameters<JSXFactory>,
		original: JSXFactory,
	) {
		const [type] = args
		if (typeof type !== 'string') {
			const name = componentName(type)
			const callbacks = name !== undefined ? waiting.get(name) : undefined

			if (callbacks) {
				waiting.delete(name!)
				// Unpatched after this call returns
				if (!waiting.size) setTimeout(stopJSX)
				for (const callback of callbacks) callback(type as ElementType)
			}
		}

		return Reflect.apply(original, this, args)
	}

	const unpatches = [
		instead(runtime, 'jsx', hook),
		instead(runtime, 'jsxs', hook),
	]
	return () => {
		for (const unpatch of unpatches) unpatch()
	}
}

function stopJSX() {
	if (waiting.size) return
	unpatchJSX?.()
	unpatchJSX = undefined
}

/**
 * Replaces the first element in a tree matching `predicate`, without mutating the original tree.
 *
 * @returns The new tree, or the original tree if nothing matched.
 */
export function replaceElement(
	tree: ReactNode,
	predicate: (element: ReactElement<any>) => boolean,
	replacer: (element: ReactElement<any>) => ReactNode,
): ReactNode {
	if (Array.isArray(tree)) {
		for (let i = 0; i < tree.length; i++) {
			const result = replaceElement(tree[i], predicate, replacer)
			if (result === tree[i]) continue

			const copy = tree.slice()
			copy[i] = result
			return copy
		}

		return tree
	}

	if (!isValidElement<{ children?: ReactNode }>(tree)) return tree
	if (predicate(tree)) return replacer(tree)

	const { children } = tree.props
	if (children == null) return tree

	const result = replaceElement(children, predicate, replacer)
	if (result === children) return tree

	return Array.isArray(result)
		? cloneElement(tree, undefined, ...result)
		: cloneElement(tree, undefined, result)
}

const wrapped = new WeakMap<object, FC<any>>()

/**
 * Wraps a function or memo component to transform its output.
 * The wrapper is cached, so React never remounts it.
 */
export function wrapComponent<P extends object>(
	type: unknown,
	transform: (tree: ReactNode, props: P) => ReactNode,
): FC<P> | undefined {
	if (typeof type !== 'function' && (typeof type !== 'object' || type === null))
		return

	const render =
		typeof type === 'function' ? type : (type as { type?: unknown }).type
	if (typeof render !== 'function') return

	let Wrapped = wrapped.get(type)
	if (!Wrapped) {
		Wrapped = (props: P) =>
			transform((render as FC<P>)(props) as ReactNode, props)
		wrapped.set(type, Wrapped)
	}

	return Wrapped
}
