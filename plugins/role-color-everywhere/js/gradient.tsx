import { Design } from '@valenced/discord/design'
import { lookupModule } from '@valenced/modules/finders'
import { withName, withProps } from '@valenced/modules/finders/filters'
import { cloneElement, isValidElement } from 'react'
import { I18nManager, StyleSheet, Text, View } from 'react-native'
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
// Not 'transparent', which Android takes for a text without a color of its own
const transparent = { color: '#fff0' }

// Emojis that are in color without a variation selector (Unicode 17): the ones that are by default,
// and all past the BMP, where only the emoji font has them. Includes the gaps left for new emojis.
const Pictograph = String.raw`[\u231A\u231B\u23E9-\u23EC\u23F0\u23F3\u25FD\u25FE\u2614\u2615\u2648-\u2653\u267F\u2693\u26A1\u26AA\u26AB\u26BD\u26BE\u26C4\u26C5\u26CE\u26D4\u26EA\u26F2\u26F3\u26F5\u26FA\u26FD\u2705\u270A\u270B\u2728\u274C\u274E\u2753-\u2755\u2757\u2795-\u2797\u27B0\u27BF\u2B1B\u2B1C\u2B50\u2B55\u{1F004}\u{1F0CF}\u{1F170}\u{1F171}\u{1F17E}\u{1F17F}\u{1F18E}\u{1F191}-\u{1F19A}\u{1F1E6}-\u{1F1FF}\u{1F201}\u{1F202}\u{1F21A}\u{1F22F}\u{1F232}-\u{1F23A}\u{1F250}\u{1F251}\u{1F300}-\u{1F321}\u{1F324}-\u{1F393}\u{1F396}\u{1F397}\u{1F399}-\u{1F39B}\u{1F39E}-\u{1F3F0}\u{1F3F3}-\u{1F3F5}\u{1F3F7}-\u{1F4FD}\u{1F4FF}-\u{1F53D}\u{1F549}-\u{1F54E}\u{1F550}-\u{1F567}\u{1F56F}\u{1F570}\u{1F573}-\u{1F57A}\u{1F587}\u{1F58A}-\u{1F58D}\u{1F590}\u{1F595}\u{1F596}\u{1F5A4}\u{1F5A5}\u{1F5A8}\u{1F5B1}\u{1F5B2}\u{1F5BC}\u{1F5C2}-\u{1F5C4}\u{1F5D1}-\u{1F5D3}\u{1F5DC}-\u{1F5DE}\u{1F5E1}\u{1F5E3}\u{1F5E8}\u{1F5EF}\u{1F5F3}\u{1F5FA}-\u{1F64F}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D2}\u{1F6D5}-\u{1F6E5}\u{1F6E9}\u{1F6EB}-\u{1F6F0}\u{1F6F3}-\u{1F6FF}\u{1F7E0}-\u{1F7FF}\u{1F90C}-\u{1F93A}\u{1F93C}-\u{1F945}\u{1F947}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]`
// Keycaps, and symbols a variation selector turns into emojis
const Emoji = String.raw`(?:${Pictograph}|[#*0-9]\uFE0F?\u20E3|[\u00A9\u00AE\u203C-\u3299]\uFE0F)`
// Captures runs of emojis, with their modifiers and joined emojis
const Emojis = new RegExp(
	String.raw`((?:${Emoji}(?:[\uFE0F\u{1F3FB}-\u{1F3FF}\u{E0020}-\u{E007F}]|\u200D${Emoji})*)+)`,
	'u',
)

function hasEmojis(node: ReactNode): boolean {
	if (typeof node === 'string') return Emojis.test(node)
	if (Array.isArray(node)) return node.some(hasEmojis)

	return (
		isValidElement<{ children?: ReactNode }>(node) &&
		hasEmojis(node.props.children)
	)
}

/**
 * Makes the emojis in a text invisible, or everything but the emojis.
 * Invisible parts keep their space, so the text is laid out the same either way.
 */
function hideParts(node: ReactNode, emojis: boolean): ReactNode {
	if (typeof node === 'string')
		// [text, emojis, text, ...]
		return node.split(Emojis).map((part, i) =>
			part && (i % 2 === 1) === emojis ? (
				<Text key={i} style={transparent}>
					{part}
				</Text>
			) : (
				part
			),
		)

	if (Array.isArray(node)) return node.map(child => hideParts(child, emojis))
	if (!isValidElement<{ children?: ReactNode }>(node)) return node

	const { children } = node.props
	if (children == null) return node

	const parts = hideParts(children, emojis)
	return Array.isArray(parts)
		? cloneElement(node, undefined, ...parts)
		: cloneElement(node, undefined, parts)
}

const withoutEmojis = <T extends ReactElement>(text: T) =>
	hideParts(text, true) as T

const onlyEmojis = <T extends ReactElement>(text: T) =>
	hideParts(text, false) as T

/**
 * Draws `content` filled with a left to right gradient, clipped to the shape of `mask`.
 * `emojis` is drawn over the gradient, for the emojis `mask` leaves out.
 *
 * @returns Nothing if the gradient components are missing.
 */
function renderGradient(
	gradient: NonNullable<RoleColors['gradient']>,
	mask: ReactElement,
	content: ReactNode,
	style: StyleProp<ViewStyle> = shrink,
	emojis?: ReactNode,
) {
	const components = getGradientComponents()
	if (!components) return

	const { MaskedView, LinearGradient } = components
	const { primaryColor, secondaryColor, tertiaryColor } = gradient
	const colors = [primaryColor, secondaryColor, tertiaryColor].filter(
		(color): color is string => !!color,
	)

	const painted = (
		<MaskedView style={emojis ? undefined : style} maskElement={mask}>
			<LinearGradient colors={colors} start={Start} end={End}>
				{content}
			</LinearGradient>
		</MaskedView>
	)

	return emojis ? (
		<View style={style}>
			{painted}
			<View
				pointerEvents="none"
				importantForAccessibility="no-hide-descendants"
				style={StyleSheet.absoluteFill}
			>
				{emojis}
			</View>
		</View>
	) : (
		painted
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
		text => {
			const { children, style } = text.props as {
				children?: ReactNode
				style?: unknown
			}
			// A gradient fills the shape of an emoji, a solid color leaves it alone
			const emojis = hasEmojis(children)

			return (
				(colors.gradient &&
					renderGradient(
						colors.gradient,
						emojis ? withoutEmojis(text) : text,
						cloneElement(text, { style: [style, hidden] }),
						undefined,
						emojis && onlyEmojis(text),
					)) ||
				cloneElement(
					text,
					undefined,
					<Text style={{ color: colors.color }}>{children}</Text>,
				)
			)
		},
	)
}

const row = { flexDirection: 'row' } as const

// Taller than any line of text
const StrutHeight = 128

const anchor = { width: 0, height: 0 } as const
const overlay = {
	position: 'absolute',
	right: 0,
	top: -StrutHeight,
	// Without a width, the zero-size anchor squeezes the name into a column of letters
	width: 2048,
	flexDirection: 'row',
	justifyContent: 'flex-end',
	alignItems: 'baseline',
} as const
const strut = { width: 0, height: StrutHeight } as const

// Hebrew and Arabic, the gradient is anchored for left to right names
const RightToLeft = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/

type DesignTextType = ComponentType<{
	variant?: unknown
	style?: unknown
	children?: ReactNode
}>

type NameElement = ReactElement<{ style?: unknown; children?: ReactNode }>

interface InlineGradientProps {
	gradient: NonNullable<RoleColors['gradient']>
	name: NameElement
	variant: unknown
	fallback: NameElement
	children?: ReactNode
}

/**
 * The name stays in the text, transparent, and the gradient is drawn over it.
 *
 * A view inside a text gets its space scaled by the system font size and sits on the baseline,
 * so a gradient that takes the place of the name overlaps or drifts away from the text around it.
 * A zero-size view takes no space at any font size, and lands on the baseline right after the name.
 */
// Has to be its own component, a gradient placed directly inside a text collapses to nothing
function InlineGradient({
	gradient,
	name,
	variant,
	fallback,
	children,
}: InlineGradientProps) {
	const { Text: DesignText } = Design as unknown as { Text: DesignTextType }
	const rename = (element: NameElement) =>
		children == null ? element : cloneElement(element, undefined, children)
	const label = rename(name)
	const text = label.props.children
	const emojis = hasEmojis(label)

	const painted =
		!I18nManager.isRTL &&
		!(typeof text === 'string' && RightToLeft.test(text)) &&
		renderGradient(
			gradient,
			<DesignText variant={variant}>
				{emojis ? withoutEmojis(label) : label}
			</DesignText>,
			<DesignText variant={variant} style={hidden}>
				{label}
			</DesignText>,
			row,
			emojis && <DesignText variant={variant}>{onlyEmojis(label)}</DesignText>,
		)

	if (!painted) return rename(fallback)

	return (
		<>
			{cloneElement(label, { style: [label.props.style, transparent] })}
			<View
				collapsable={false}
				pointerEvents="none"
				importantForAccessibility="no-hide-descendants"
				style={anchor}
			>
				<View style={overlay}>
					{/* Its bottom is the baseline the name is aligned to */}
					<View style={strut} />
					{painted}
				</View>
			</View>
		</>
	)
}

/**
 * Colors an inline name inside a `Design.Text` with the given variant.
 */
export function paintInlineName(
	name: NameElement,
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
