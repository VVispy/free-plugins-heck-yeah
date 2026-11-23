import { Design } from '@valenced/discord/design'
import { lookupModule } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { cloneElement } from 'react'
import { Text } from 'react-native'
import { replaceElement } from './react'
import type { ComponentType, ReactElement, ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import type { RoleColors } from './shared'

type MaskedViewType = ComponentType<{
	style?: StyleProp<ViewStyle>
	maskElement: ReactElement
	children?: ReactNode
}>

type LinearGradientType = ComponentType<{
	colors: string[]
	start?: { x: number; y: number }
	end?: { x: number; y: number }
	children?: ReactNode
}>

let MaskedView: MaskedViewType | null | undefined
let LinearGradient: LinearGradientType | null | undefined

function getGradientComponents() {
	MaskedView ??= lookupModule(withName<MaskedViewType>('MaskedView'))[0] ?? null
	LinearGradient ??=
		lookupModule(
			withProps<{
				LinearGradient: LinearGradientType
				LinearGradientNativeComponent: unknown
			}>('LinearGradient', 'LinearGradientNativeComponent'),
		)[0]?.LinearGradient ?? null

	return MaskedView && LinearGradient
		? { MaskedView, LinearGradient }
		: undefined
}

const Start = { x: 0, y: 0 }
const End = { x: 1, y: 0 }

const shrink = { flexShrink: 1 }
const hidden = { opacity: 0 }

/**
 * Draws `content` filled with a left to right gradient, clipped to the shape of `mask`.
 *
 * @returns Nothing if the gradient components are missing.
 */
function renderGradient(
	gradient: NonNullable<RoleColors['gradient']>,
	mask: ReactElement,
	content: ReactNode,
	style: StyleProp<ViewStyle> = shrink,
) {
	const components = getGradientComponents()
	if (!components) return

	const { MaskedView, LinearGradient } = components
	const { primaryColor, secondaryColor, tertiaryColor } = gradient
	const colors = [primaryColor, secondaryColor, tertiaryColor].filter(
		(color): color is string => !!color,
	)

	return (
		<MaskedView style={style} maskElement={mask}>
			<LinearGradient colors={colors} start={Start} end={End}>
				{content}
			</LinearGradient>
		</MaskedView>
	)
}

/**
 * Colors the first `Design.Text` in a tree.
 * Its `color` prop only takes theme tokens, so a nested text carries solid colors.
 */
export function paintText(tree: ReactNode, colors: RoleColors) {
	return replaceElement(
		tree,
		element => element.type === Design.Text,
		text =>
			(colors.gradient &&
				renderGradient(
					colors.gradient,
					text,
					cloneElement(text, {
						style: [(text.props as { style?: unknown }).style, hidden],
					}),
				)) ||
			cloneElement(
				text,
				undefined,
				<Text style={{ color: colors.color }}>
					{(text.props as { children?: ReactNode }).children}
				</Text>,
			),
	)
}

const row = { flexDirection: 'row' } as const

type DesignTextType = ComponentType<{
	variant?: unknown
	style?: unknown
	children?: ReactNode
}>

interface InlineGradientProps {
	gradient: NonNullable<RoleColors['gradient']>
	name: ReactElement
	variant: unknown
	fallback: ReactElement
	children?: ReactNode
}

// Has to be its own component, a gradient placed directly inside a text collapses to nothing
function InlineGradient({
	gradient,
	name,
	variant,
	fallback,
	children,
}: InlineGradientProps) {
	const { Text: DesignText } = Design as unknown as { Text: DesignTextType }
	const rename = (element: ReactElement) =>
		children == null ? element : cloneElement(element, undefined, children)
	const label = rename(name)

	return (
		renderGradient(
			gradient,
			<DesignText variant={variant}>{label}</DesignText>,
			<DesignText variant={variant} style={hidden}>
				{label}
			</DesignText>,
			row,
		) ?? rename(fallback)
	)
}

/**
 * Colors an inline name inside a `Design.Text` with the given variant.
 */
export function paintInlineName(
	name: ReactElement<{ style?: unknown }>,
	colors: RoleColors,
	variant: unknown,
) {
	const solid = cloneElement(name, {
		style: [name.props.style, { color: colors.color }],
	})

	return colors.gradient ? (
		<InlineGradient
			gradient={colors.gradient}
			name={name}
			variant={variant}
			fallback={solid}
		/>
	) : (
		solid
	)
}
