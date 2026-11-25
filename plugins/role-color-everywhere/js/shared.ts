import { Stores } from '@valenced/discord/flux'
import { lookupModule } from '@valenced/modules/finders'
import { withProps } from '@valenced/modules/finders/filters'
import type { DiscordModules } from '@valenced/discord/types'
import type { JsonStorage } from '@valenced/json-storage'

export interface Settings {
	chatMentions: boolean
	mentionAutocomplete: boolean
	memberList: boolean
	memberListHeaderSize: number
	memberListBoldHeaders: boolean
	voiceUsers: boolean
	reactorsList: boolean
	pollResults: boolean
	typingIndicator: boolean
	/** Shows custom typing messages (Nitro) as regular ones */
	regularTypingMessages: boolean
	/** Gradients for roles with enhanced role colors */
	gradients: boolean
}

export const DefaultSettings: Settings = {
	chatMentions: true,
	mentionAutocomplete: true,
	memberList: true,
	memberListHeaderSize: 2,
	memberListBoldHeaders: false,
	voiceUsers: true,
	reactorsList: true,
	pollResults: true,
	typingIndicator: true,
	regularTypingMessages: true,
	gradients: true,
}

let storage: JsonStorage<Settings> | undefined
const requestedMembers = new Set<string>()

export function setStorage(s: JsonStorage<Settings> | undefined) {
	storage = s
	if (!s) requestedMembers.clear()
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
	color?: number | null
	colorString?: string | null
	colorStrings?: ColorStrings | null
	roles?: (string | { id?: string })[]
}

export interface Role extends Colored {
	id: string
	name: string
	position?: number
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
					id?: string
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
				getRole?(guildId: string, roleId: string): Role | undefined
				getSortedRoles?(guildId: string): Role[] | undefined
				getRolesSnapshot?(guildId: string): Record<string, Role> | undefined
		  }>
		| undefined

const getSelectedGuildStore = () =>
	Stores.SelectedGuildStore as Store<{
		getGuildId(): string | null | undefined
	}>

const getSelectedChannelStore = () =>
	Stores.SelectedChannelStore as Store<{
		getChannelId(): string | null | undefined
		getVoiceChannelId(): string | null | undefined
	}>

const getChannelStore = () =>
	Stores.ChannelStore as Store<{
		getChannel(id: string): { guild_id?: string | null } | undefined
	}>

export function getGuildIdOfChannel(channelId: string | null | undefined) {
	return (
		(channelId && getChannelStore().getChannel(channelId)?.guild_id) ||
		undefined
	)
}

export function getGuildId(channelOrGuildId: string | null | undefined) {
	if (!channelOrGuildId) return
	return (
		getGuildIdOfChannel(channelOrGuildId) ??
		getGuildStore().getGuild(channelOrGuildId)?.id
	)
}

export function getSelectedChannelId() {
	return getSelectedChannelStore().getChannelId() || undefined
}

/**
 * Returns the guild of the voice channel the user is connected to.
 */
export function getVoiceGuildId() {
	return getGuildIdOfChannel(getSelectedChannelStore().getVoiceChannelId())
}

function hasEnhancedRoleColors(guildId: string) {
	const features = getGuildStore().getGuild(guildId)?.features
	return !!(
		features?.has?.(EnhancedRoleColors) ??
		features?.includes?.(EnhancedRoleColors)
	)
}

function resolveColorHex(source: Colored | null | undefined) {
	if (source?.colorString) return source.colorString
	if (source?.colorStrings?.primaryColor)
		return source.colorStrings.primaryColor
	if (
		typeof source?.color === 'number' &&
		Number.isFinite(source.color) &&
		source.color > 0 &&
		source.color <= 0xffffff
	)
		return `#${Math.trunc(source.color).toString(16).padStart(6, '0')}`
	return undefined
}

function colorsFromSource(
	guildId: string | null | undefined,
	source: Colored | null | undefined,
): RoleColors | undefined {
	const color = resolveColorHex(source)
	if (!color) return

	const strings = source?.colorStrings
	if (
		!guildId ||
		!strings?.secondaryColor ||
		!getSetting('gradients') ||
		!hasEnhancedRoleColors(guildId)
	)
		return { color }

	return {
		color,
		gradient: {
			...strings,
			primaryColor: strings.primaryColor || color,
			secondaryColor: strings.secondaryColor,
		},
	}
}

/**
 * Returns the colors of a guild member or role.
 */
export function getColors(
	guildId: string | null | undefined,
	source: Colored | null | undefined,
): RoleColors | undefined {
	const direct = colorsFromSource(guildId, source)
	if (direct || !guildId || !source?.roles?.length) return direct

	const roles: Role[] = []
	for (const entry of source.roles) {
		const id = typeof entry === 'string' ? entry : entry?.id
		const role = id ? getRole(guildId, id) : undefined
		if (role) roles.push(role)
	}
	roles.sort((a, b) => Number(b.position ?? 0) - Number(a.position ?? 0))

	for (const role of roles) {
		const colors = colorsFromSource(guildId, role)
		if (colors) return colors
	}

	return undefined
}

export const noopSubscribe = () => () => {}

/**
 * Subscribes to guild member changes.
 *
 * @returns A function to unsubscribe.
 */
export function subscribeToMembers(callback: () => void) {
	const store = getGuildMemberStore()
	store.addChangeListener(callback)
	return () => store.removeChangeListener(callback)
}

type RequestMembersById = (
	guildId: string,
	userIds: string[],
	presences?: boolean,
) => void

let cachedRequestMembersById: RequestMembersById | null | undefined

function getRequestMembersById() {
	if (cachedRequestMembersById === undefined) {
		cachedRequestMembersById =
			lookupModule(
				withProps<{ requestMembersById: RequestMembersById }>(
					'requestMembersById',
				),
			)[0]?.requestMembersById ?? null
	}
	return cachedRequestMembersById
}

/**
 * Asks Discord to load a guild member. Requests are batched and deduplicated by Discord.
 */
export function requestMember(guildId: string, userId: string) {
	const store = Stores.GuildMemberRequesterStore as
		| Store<{ requestMember?(guildId: string, userId: string): void }>
		| undefined
	if (store?.requestMember) {
		store.requestMember(guildId, userId)
		return
	}
	getRequestMembersById()?.(guildId, [userId], false)
}

export function requestMembers(guildId: string, userIds: string[]) {
	const pending: string[] = []
	for (const userId of userIds) {
		const key = `${guildId}:${userId}`
		if (requestedMembers.has(key)) continue
		requestedMembers.add(key)
		pending.push(userId)
	}
	if (!pending.length) return

	const requestById = getRequestMembersById()
	if (requestById) {
		for (let i = 0; i < pending.length; i += 100) {
			requestById(guildId, pending.slice(i, i + 100), false)
		}
		return
	}
	for (const userId of pending) requestMember(guildId, userId)
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

export function getRole(
	guildId: string | null | undefined,
	roleId: string | null | undefined,
): Role | undefined {
	if (!guildId || !roleId) return
	return (
		getGuildRoleStore()?.getRole?.(guildId, roleId) ??
		getRoles(guildId).find(role => role.id === roleId)
	)
}

/**
 * Parses a hex color string to an RGB integer, the format Discord uses for role colors.
 */
export function hexToInt(hex: string) {
	return Number.parseInt(hex.slice(1, 7), 16)
}
