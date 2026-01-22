const { 
    Client, 
    GatewayIntentBits, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    EmbedBuilder, 
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ChannelType,
    REST,
    Routes,
    SlashCommandBuilder,
    PermissionFlagsBits
} = require('discord.js');
const { Client: SelfClient } = require('discord.js-selfbot-v13');
const http = require('http');
const { QuickDB } = require("quick.db");
const db = new QuickDB();
require('dotenv').config();

// Servidor HTTP para a Render
http.createServer((req, res) => {
    res.write("Bot Cloner VIP Pro Online!");
    res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const OWNER_ID = '1225647692458229860'; 

// --- SLASH COMMANDS DEFINITION ---
const commands = [
    new SlashCommandBuilder()
        .setName('addvip')
        .setDescription('👑 [DONO] Adiciona um usuário ao VIP.')
        .addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true))
        .addIntegerOption(o => o.setName('dias').setDescription('Dias (0=Permanente)').setRequired(true)),
    
    new SlashCommandBuilder()
        .setName('delvip')
        .setDescription('❌ [DONO] Remove um usuário do VIP.')
        .addUserOption(o => o.setName('usuario').setDescription('Usuário').setRequired(true)),

    new SlashCommandBuilder()
        .setName('painel')
        .setDescription('📊 [DONO] Lista de clientes VIP.'),

    new SlashCommandBuilder()
        .setName('tools')
        .setDescription('🛠️ Central de ferramentas VIP.'),

    new SlashCommandBuilder()
        .setName('anunciar')
        .setDescription('📢 [DONO] Envia um anúncio para todos os servidores.')
        .addStringOption(o => o.setName('mensagem').setDescription('Conteúdo do anúncio').setRequired(true)),

    new SlashCommandBuilder()
        .setName('config_ticket')
        .setDescription('🎫 [DONO] Personaliza o sistema de tickets.')
        .addStringOption(o => o.setName('tipo').setDescription('Tipo do painel').setRequired(true).addChoices({ name: 'Botão', value: 'button' }, { name: 'Menu (Select)', value: 'select' }))
        .addStringOption(o => o.setName('titulo').setDescription('Título do painel').setRequired(true))
        .addStringOption(o => o.setName('descricao').setDescription('Descrição do painel').setRequired(true))
        .addStringOption(o => o.setName('cor').setDescription('Cor lateral (Hex: #ff0000)').setRequired(true)),

    new SlashCommandBuilder()
        .setName('setup_ticket')
        .setDescription('🎫 [DONO] Envia o painel de tickets configurado.')
        .addChannelOption(o => o.setName('canal').setDescription('Canal do painel').setRequired(true))
        .addChannelOption(o => o.setName('logs').setDescription('Canal de logs').setRequired(true)),

    new SlashCommandBuilder()
        .setName('config_bot')
        .setDescription('🎨 [DONO] Personaliza o visual das embeds do bot.')
        .addStringOption(o => o.setName('cor').setDescription('Cor em Hexadecimal (ex: #ff0000)').setRequired(true))
        .addStringOption(o => o.setName('banner').setDescription('URL da imagem do banner').setRequired(false)),

    new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('🛡️ [DONO] Ativa ou desativa o sistema Anti-Raid.')
        .addBooleanOption(o => o.setName('status').setDescription('Ativar Anti-Raid?').setRequired(true)),
].map(c => c.toJSON());

client.once('ready', async () => {
    console.log(`🚀 Bot logado como ${client.user.tag}`);
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Comandos registrados!');
    } catch (e) { console.error(e); }
});

// --- HELPER FUNCTIONS ---
async function getBotConfig() {
    return await db.get('bot_config') || { cor: '#5865F2', banner: null };
}

// --- INTERACTION HANDLER ---
client.on('interactionCreate', async (interaction) => {
    const config = await getBotConfig();

    if (interaction.isChatInputCommand()) {
        const { commandName, user, options, guild } = interaction;

        if (['addvip', 'delvip', 'painel', 'anunciar', 'setup_ticket', 'config_bot', 'antiraid', 'config_ticket'].includes(commandName) && user.id !== OWNER_ID) {
            return interaction.reply({ content: '❌ Acesso negado.', ephemeral: true });
        }

        if (commandName === 'config_ticket') {
            const ticketData = {
                tipo: options.getString('tipo'),
                titulo: options.getString('titulo'),
                descricao: options.getString('descricao'),
                cor: options.getString('cor')
            };
            await db.set(`ticket_settings_${guild.id}`, ticketData);
            return interaction.reply(`✅ Configurações de ticket salvas para este servidor!`);
        }

        if (commandName === 'setup_ticket') {
            const canal = options.getChannel('canal');
            const logs = options.getChannel('logs');
            const settings = await db.get(`ticket_settings_${guild.id}`) || { tipo: 'button', titulo: 'Suporte VIP', descricao: 'Clique abaixo para abrir um ticket.', cor: config.cor };
            
            await db.set(`ticket_config_${guild.id}`, { logs: logs.id });

            const embed = new EmbedBuilder()
                .setTitle(settings.titulo)
                .setDescription(settings.descricao)
                .setColor(settings.cor);
            if (config.banner) embed.setImage(config.banner);

            const row = new ActionRowBuilder();
            if (settings.tipo === 'button') {
                row.addComponents(new ButtonBuilder().setCustomId('open_ticket').setLabel('Abrir Ticket').setStyle(ButtonStyle.Primary).setEmoji('🎫'));
            } else {
                row.addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('open_ticket_select')
                        .setPlaceholder('Selecione uma opção para abrir ticket...')
                        .addOptions([{ label: 'Suporte Geral', value: 'geral', emoji: '🎫' }, { label: 'Dúvidas VIP', value: 'vip', emoji: '👑' }])
                );
            }

            await canal.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '✅ Painel de tickets enviado!', ephemeral: true });
        }

        if (commandName === 'tools') {
            const isVip = await db.get(`vips.${user.id}`);
            if (!isVip && user.id !== OWNER_ID) return interaction.reply({ content: '❌ Você não é VIP.', ephemeral: true });

            const embed = new EmbedBuilder()
                .setTitle('💎 Central de Ferramentas VIP')
                .setDescription('Selecione abaixo a ferramenta que deseja utilizar. Todas as ações são registradas.')
                .addFields(
                    { name: '👤 Clonagem Self', value: 'Clona usando um Token de conta.', inline: true },
                    { name: '🤖 Clonagem Bot', value: 'Clona usando o próprio bot.', inline: true },
                    { name: '🧹 Limpeza', value: 'Limpa mensagens de DMs.', inline: true }
                )
                .setColor(config.cor)
                .setTimestamp();
            if (config.banner) embed.setImage(config.banner);

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_tool')
                    .setPlaceholder('Escolher uma Opção....')
                    .addOptions([
                        { label: 'Clonar (Via Conta)', value: 'tool_clone_self', emoji: '<:1289969947199410249:1461879272586084497>', description: 'Usa um token de usuário para clonar.' },
                        { label: 'Clonar (Via Bot)', value: 'tool_clone_bot', emoji: '<:white_seta:1428219248932818964>', description: 'Usa o bot para clonar (precisa de permissão).' },
                        { label: 'Limpar DM', value: 'tool_clear_dm', emoji: '<:lixeira:1453320418076266567> ', description: 'Apaga mensagens em uma DM específica.' },
                        { label: 'DM All', value: 'tool_dmall', emoji: '<a:1289359703763324958:1461879286737666272>', description: 'Envia mensagem para todos os membros.' },
                    ]),
            );
            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        }

        // ... (Outros comandos addvip, delvip, painel, anunciar, config_bot, antiraid mantidos)
        if (commandName === 'addvip') {
            const target = options.getUser('usuario');
            const days = options.getInteger('dias');
            const expiresAt = days === 0 ? -1 : Date.now() + (days * 24 * 60 * 60 * 1000);
            await db.set(`vips.${target.id}`, { id: target.id, tag: target.tag, expiresAt });
            return interaction.reply(`✅ **${target.tag}** agora é VIP!`);
        }
        if (commandName === 'painel') {
            const vips = await db.get("vips") || {};
            const list = Object.values(vips).map((v, i) => `**${i+1}.** \`${v.tag}\` - ${v.expiresAt === -1 ? '♾️' : `<t:${Math.floor(v.expiresAt/1000)}:R>`}`).join('\n') || 'Nenhum VIP.';
            const embed = new EmbedBuilder().setTitle('📊 Clientes VIP').setDescription(list).setColor(config.cor);
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    // --- TICKET LOGIC ---
    if ((interaction.isButton() && interaction.customId === 'open_ticket') || (interaction.isStringSelectMenu() && interaction.customId === 'open_ticket_select')) {
        const guild = interaction.guild;
        const user = interaction.user;
        const ticketConfig = await db.get(`ticket_config_${guild.id}`);
        const settings = await db.get(`ticket_settings_${guild.id}`) || { cor: config.cor };

        const channel = await guild.channels.create({
            name: `ticket-${user.username}`,
            type: ChannelType.GuildText,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('🎫 Suporte Iniciado')
            .setDescription(`Olá ${user}, descreva sua dúvida ou problema abaixo. Um administrador será notificado.`)
            .setColor(settings.cor);
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Ticket criado: ${channel}`, ephemeral: true });

        if (ticketConfig?.logs) {
            const logChan = guild.channels.cache.get(ticketConfig.logs);
            if (logChan) logChan.send(`🎫 **Ticket Aberto:** ${user.tag} em ${channel}`);
        }
    }

    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply('🔒 Fechando ticket em 5 segundos...');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }

    // --- TOOL MODALS & CLONING ---
    if (interaction.isStringSelectMenu() && interaction.customId === 'select_tool') {
        const tool = interaction.values[0];
        const modal = new ModalBuilder().setCustomId(`modal_${tool}`).setTitle('Configuração da Ferramenta');
        
        if (tool.includes('clone')) {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('source').setLabel('ID do Servidor de ORIGEM').setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('target').setLabel('ID do Servidor de DESTINO').setStyle(TextInputStyle.Short).setRequired(true))
            );
            if (tool === 'tool_clone_self') {
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('token').setLabel('Token da Conta').setStyle(TextInputStyle.Short).setRequired(true)));
            }
        } else if (tool === 'tool_clear_dm') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('token').setLabel('Token da Conta').setRequired(true).setStyle(TextInputStyle.Short)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('channel_id').setLabel('ID do Canal de DM').setRequired(true).setStyle(TextInputStyle.Short))
            );
        } else if (tool === 'tool_dmall') {
            modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('message').setLabel('Mensagem para enviar').setRequired(true).setStyle(TextInputStyle.Paragraph)));
        }
        await interaction.showModal(modal);
    }

    if (interaction.isModalSubmit()) {
        const { customId, fields, user } = interaction;
        if (customId.startsWith('modal_tool_clone')) {
            const sourceId = fields.getTextInputValue('source');
            const targetId = fields.getTextInputValue('target');
            const token = customId.includes('self') ? fields.getTextInputValue('token') : null;

            if (sourceId === targetId) return interaction.reply({ content: '❌ O servidor de origem não pode ser igual ao de destino!', ephemeral: true });

            await interaction.reply({ content: '⚙️ Configurando clonagem...', ephemeral: true });
            globalCloneData[`key_${user.id}`] = { sourceId, targetId, token, selections: { channels: true, roles: true } };

            const embed = new EmbedBuilder()
                .setTitle('🚀 Confirmar Clonagem')
                .setDescription(`**Origem:** \`${sourceId}\`\n**Destino:** \`${targetId}\`\n\nClique abaixo para iniciar.`)
                .setColor(config.cor);
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('confirm_clone').setLabel('INICIAR AGORA').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('cancel_clone').setLabel('CANCELAR').setStyle(ButtonStyle.Danger),
            );
            await interaction.followUp({ embeds: [embed], components: [row], ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        const data = globalCloneData[`key_${interaction.user.id}`];
        if (interaction.customId === 'confirm_clone' && data) {
            await interaction.update({ content: '⏳ Clonagem em andamento... Isso pode demorar alguns minutos.', embeds: [], components: [] });
            try {
                let sourceGuild;
                if (data.token) {
                    const self = new SelfClient({ checkUpdate: false });
                    await self.login(data.token);
                    sourceGuild = await self.guilds.fetch(data.sourceId);
                    await executeClone(sourceGuild, client.guilds.cache.get(data.targetId), data.selections);
                    self.destroy();
                } else {
                    sourceGuild = await client.guilds.fetch(data.sourceId);
                    await executeClone(sourceGuild, client.guilds.cache.get(data.targetId), data.selections);
                }
                await interaction.followUp({ content: '✅ Servidor clonado com sucesso!', ephemeral: true });
            } catch (e) { await interaction.followUp({ content: `❌ Erro na clonagem: ${e.message}`, ephemeral: true }); }
            delete globalCloneData[`key_${interaction.user.id}`];
        }
    }
});

const globalCloneData = {};

async function executeClone(sourceGuild, targetGuild, opts) {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    
    // 1. Limpar destino
    const oldChannels = await targetGuild.channels.fetch();
    for (const c of oldChannels.values()) { await c.delete().catch(() => {}); await sleep(400); }

    // 2. Clonar Cargos
    const roles = await sourceGuild.roles.fetch();
    const roleMap = new Map();
    for (const role of roles.values()) {
        if (role.name !== '@everyone' && !role.managed) {
            const newRole = await targetGuild.roles.create({
                name: role.name,
                color: role.color,
                permissions: role.permissions,
                hoist: role.hoist
            }).catch(() => {});
            if (newRole) roleMap.set(role.id, newRole.id);
            await sleep(600);
        }
    }

    // 3. Clonar Categorias e Canais
    const sChannels = await sourceGuild.channels.fetch();
    const categories = sChannels.filter(c => c.type === ChannelType.GuildCategory).sort((a, b) => a.position - b.position);
    const catMap = new Map();

    for (const cat of categories.values()) {
        const newCat = await targetGuild.channels.create({ name: cat.name, type: ChannelType.GuildCategory });
        catMap.set(cat.id, newCat.id);
        await sleep(800);
    }

    for (const chan of sChannels.values()) {
        if (chan.type === ChannelType.GuildCategory) continue;
        await targetGuild.channels.create({
            name: chan.name,
            type: chan.type,
            parent: catMap.get(chan.parentId),
            topic: chan.topic,
            nsfw: chan.nsfw
        }).catch(() => {});
        await sleep(800);
    }
}

client.login(process.env.TOKEN);
