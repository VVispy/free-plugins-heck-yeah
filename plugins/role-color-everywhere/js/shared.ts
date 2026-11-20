import { Tokens } from '@valenced/discord/common/tokens'
import { Stores } from '@valenced/discord/flux'
import { processColor } from 'react-native'
import type { DiscordModules } from '@valenced/discord/types'
import type { JsonStorage } from '@valenced/json-storage'

export interface Settings {
	chatMentions: boolean
	memberList: boolean
	voiceUsers: boolean
	typingIndicator: boolean
	/** Gradients for roles with enhanced role colors */
	gradients: boolean
	colorChatMessages: boolean
	/** Percentage of the role color mixed into message text */
	messageSaturation: number
}

export const DefaultSettings: Settings = {
	chatMentions: true,
	memberList: true,
	voiceUsers: true,
	typingIndicator: true,
	gradients: true,
	colorChatMessages: false,
	messageSaturation: 30,
}

let storage: JsonStorage<Settings> | undefined

export function setStorage(s: JsonStorage<Settings> | undefined) {
	storage = s
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
	return (
		(storage?.cache as Partial<Settings> | undefined)?.[key] ??
		DefaultSettings[key]
	)
}

export interface ColorStrings {
	primaryColor: string
	secondaryColor?: string | null
	tertiaryColor?: string | null
}

/** Guild member or role */
export interface Colored {
	colorString?: string | null
	colorStrings?: ColorStrings | null
}

export interface Role extends Colored {
	id: string
	name: string
}

export interface RoleColors {
	/** Solid color, the primary color of a gradient */
	color: string
	/** Set for enhanced role colors when gradients are enabled */
	gradient?: ColorStrings & { secondaryColor: string }
}

type Store<T> = DiscordModules.Flux.Store<T>

const EnhancedRoleColors = 'ENHANCED_ROLE_COLORS'

const getGuildStore = () =>
	Stores.GuildStore as Store<{
		getGuild(id: string):
			| {
					features?: {
						has?(feature: string): boolean
						includes?(feature: string): boolean
					}
			  }
			| undefined
	}>

const getGuildMemberStore = () =>
	Stores.GuildMemberStore as Store<{
		getMember(guildId: string, userId: string): Colored | null | undefined
	}>

const getGuildRoleStore = () =>
	Stores.GuildRoleStore as
		| Store<{
				getSortedRoles?(guildId: string): Role[] | undefined
				getRolesSnapshot?(guildId: string): Record<string, Role> | undefined
		  }>
		| undefined

const getSelectedGuildStore = () =>
	Stores.SelectedGuildStore as Store<{
		getGuildId(): string | null | undefined
	}>

function hasEnhancedRoleColors(guildId: string) {
	const features = getGuildStore().getGuild(guildId)?.features
	return !!(
		features?.has?.(EnhancedRoleColors) ??
		features?.includes?.(EnhancedRoleColors)
	)
}

/**
 * Returns the colors of a guild member or role.
 */
export function getColors(
	guildId: string | null | undefined,
	source: Colored | null | undefined,
): RoleColors | undefined {
	const color = source?.colorString
	if (!color) return

	const strings = source.colorStrings
	if (
		!guildId ||
		!strings?.secondaryColor ||
		!getSetting('gradients') ||
		!hasEnhancedRoleColors(guildId)
	)
		return { color }

	return { color, gradient: strings as RoleColors['gradient'] }
}

export function getMember(
	guildId: string | null | undefined,
	userId: string | null | undefined,
) {
	if (!guildId || !userId) return
	return getGuildMemberStore().getMember(guildId, userId) ?? undefined
}

export function getMemberColors(
	guildId: string | null | undefined,
	userId: string | null | undefined,
) {
	return getColors(guildId, getMember(guildId, userId))
}

/**
 * Returns the top role color of a guild member as a hex string.
 */
export function getMemberColor(
	guildId: string | null | undefined,
	userId: string | null | undefined,
) {
	return getMember(guildId, userId)?.colorString || undefined
}

export function getSelectedGuildId() {
	return getSelectedGuildStore().getGuildId() || undefined
}

export function getRoles(guildId: string): Role[] {
	const store = getGuildRoleStore()
	return (
		store?.getSortedRoles?.(guildId) ??
		Object.values(store?.getRolesSnapshot?.(guildId) ?? {})
	)
}

/**
 * Parses a hex color string to an RGB integer, the format Discord uses for role colors.
 */
export function hexToInt(hex: string) {
	return Number.parseInt(hex.slice(1, 7), 16)
}

type ThemeStore = Store<{ theme: string }>

function defaultTextColor() {
	const theme = (Stores.ThemeStore as ThemeStore).theme
	const { colors, internal } = Tokens.default
	return internal.resolveSemanticColor(
		theme,
		colors.TEXT_DEFAULT ?? colors.TEXT_NORMAL,
	)
}

const mixCache = new Map<string, number | undefined>()

/**
 * Mixes `color` into the default text color in Oklab, like CSS `color-mix(in oklab, ...)`.
 *
 * @param weight Percentage of `color`, from 0 to 100.
 * @returns The mixed color, as a native color number.
 */
export function mixWithTextColor(color: string, weight: number) {
	const base = defaultTextColor()
	const key = `${base}|${color}|${weight}`
	if (mixCache.has(key)) return mixCache.get(key)

	const from = toRgba(base)
	const to = toRgba(color)
	let result: number | undefined

	if (from && to) {
		const t = Math.min(Math.max(weight, 0), 100) / 100
		const a = toOklab(from)
		const b = toOklab(to)
		const [r, g, bl] = fromOklab(a.map((v, i) => v + (b[i]! - v) * t) as Vec3)
		const alpha = from[3] + (to[3] - from[3]) * t
		result = processColor(`#${[r, g, bl, alpha].map(hexByte).join('')}`) as
			| number
			| undefined
	}

	mixCache.set(key, result)
	return result
}

type Vec3 = [number, number, number]

function toRgba(color: unknown): [number, number, number, number] | undefined {
	const n = processColor(color as string)
	if (typeof n !== 'number') return
	// ARGB, signed on Android
	const u = n >>> 0
	return [(u >>> 16) & 255, (u >>> 8) & 255, u & 255, u >>> 24]
}

const hexByte = (v: number) =>
	Math.round(Math.min(Math.max(v, 0), 255))
		.toString(16)
		.padStart(2, '0')

const toLinear = (c: number) =>
	c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4

const fromLinear = (c: number) =>
	c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055

function toOklab([r8, g8, b8]: readonly number[]): Vec3 {
	const r = toLinear(r8! / 255)
	const g = toLinear(g8! / 255)
	const b = toLinear(b8! / 255)

	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	]
}

function fromOklab([L, a, b]: Vec3): Vec3 {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3

	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186168 * m + 1.707614701 * s,
	].map(c => fromLinear(c) * 255) as Vec3
}
