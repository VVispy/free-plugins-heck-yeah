import { instead } from '@valenced/patcher'
import { ReactJSXRuntime } from '@valenced/react'
import { beforeJSX } from '@valenced/react/jsx-runtime'
import { cloneElement, forwardRef, isValidElement, memo } from 'react'
import type {
	ComponentType,
	ElementType,
	FC,
	ReactElement,
	ReactNode,
} from 'react'

type JSXFactory = (type: unknown, props: unknown, key?: unknown) => unknown

/**
 * Returns the name of a function, memo or forwardRef component.
 */
export function componentName(type: unknown): string | undefined {
	if (typeof type === 'function')
		return (
			(type as { displayName?: string }).displayName || type.name || undefined
		)
	if (typeof type !== 'object' || type === null) return

	const obj = type as {
		displayName?: string
		type?: unknown
		render?: unknown
	}
	if (typeof obj.displayName === 'string' && obj.displayName.length > 0)
		return obj.displayName

	const inner = obj.type ?? obj.render
	return typeof inner === 'function'
		? (inner as { displayName?: string }).displayName || inner.name || undefined
		: componentName(inner)
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

const wrapped = new WeakMap<object, WeakMap<object, ComponentType<any>>>()

/**
 * Wraps a function, memo or forwardRef component to transform its output.
 * The wrapper is cached per transform, so React never remounts it. Memo components stay memoized.
 */
export function wrapComponent<P extends object>(
	type: unknown,
	transform: (tree: ReactNode, props: P) => ReactNode,
): ComponentType<P> | undefined {
	if (typeof type !== 'function' && (typeof type !== 'object' || type === null))
		return

	let cache = wrapped.get(transform)
	if (!cache) wrapped.set(transform, (cache = new WeakMap()))

	let Wrapped = cache.get(type)
	if (Wrapped) return Wrapped

	if (typeof type === 'function') {
		Wrapped = (props: P) =>
			transform((type as FC<P>)(props) as ReactNode, props)
	} else {
		const obj = type as {
			type?: unknown
			render?: (props: P, ref: unknown) => ReactNode
			compare?: Parameters<typeof memo>[1]
		}
		if (typeof obj.type === 'function') {
			const render = obj.type as FC<P>
			const Render = (props: P) => transform(render(props) as ReactNode, props)
			Wrapped = memo(Render, obj.compare)
		} else if (typeof obj.render === 'function') {
			const render = obj.render
			Wrapped = forwardRef((props, ref) =>
				transform(render(props as P, ref), props as P),
			) as unknown as ComponentType<P>
		} else if (
			typeof obj.type === 'object' &&
			obj.type !== null &&
			typeof (obj.type as { render?: unknown }).render === 'function'
		) {
			const render = (
				obj.type as { render: (props: P, ref: unknown) => ReactNode }
			).render
			const Forwarded = forwardRef((props, ref) =>
				transform(render(props as P, ref), props as P),
			)
			Wrapped = memo(Forwarded, obj.compare) as unknown as ComponentType<P>
		} else {
			return
		}
	}

	cache.set(type, Wrapped)
	return Wrapped
}

export function mapElements(
	tree: ReactNode,
	mapper: (element: ReactElement<any>) => ReactElement<any>,
	maxDepth = 8,
	depth = 0,
): ReactNode {
	if (depth > maxDepth) return tree

	if (Array.isArray(tree)) {
		let changed = false
		const next = tree.map(child => {
			const mapped = mapElements(child, mapper, maxDepth, depth)
			if (mapped !== child) changed = true
			return mapped
		})
		return changed ? next : tree
	}

	if (!isValidElement<{ children?: ReactNode }>(tree)) return tree

	const current = mapper(tree)
	const { children } = current.props as { children?: ReactNode }
	if (children == null) return current

	const mappedChildren = mapElements(children, mapper, maxDepth, depth + 1)
	if (mappedChildren === children) return current

	return Array.isArray(mappedChildren)
		? cloneElement(current, undefined, ...mappedChildren)
		: cloneElement(current, undefined, mappedChildren)
}

export function wrapListRenderItem(
	tree: ReactNode,
	transformItem: (rendered: ReactNode, info: any) => ReactNode,
	maxDepth = 6,
): ReactNode {
	return mapElements(
		tree,
		element => {
			const renderItem = element.props?.renderItem
			if (typeof renderItem !== 'function' || renderItem.__rceWrapped)
				return element

			const wrappedRenderItem = Object.assign(
				(info: any) => transformItem(renderItem(info), info),
				{ __rceWrapped: true },
			)
			return cloneElement(element, { renderItem: wrappedRenderItem })
		},
		maxDepth,
	)
}

/**
 * Transforms the output of every element of the component named `name`.
 *
 * @param enabled Checked per element, so a disabled transform leaves the component untouched.
 * @returns A function to unpatch.
 */
export function transformComponent<P extends object>(
	name: string,
	enabled: () => boolean,
	transform: (tree: ReactNode, props: P) => ReactNode,
	reportError: (e: unknown) => void,
) {
	let unpatch: (() => unknown) | undefined

	const safeTransform = (tree: ReactNode, props: P) => {
		try {
			return transform(tree, props)
		} catch (e) {
			reportError(e)
			return tree
		}
	}

	const stop = onComponentType(name, type => {
		unpatch = beforeJSX(type as FC<P>, args => {
			if (!enabled()) return args

			const Wrapped = wrapComponent<P>(type, safeTransform)
			return Wrapped
				? ([Wrapped, ...args.slice(1)] as unknown as typeof args)
				: args
		})
	})

	return () => {
		stop()
		unpatch?.()
	}
}
