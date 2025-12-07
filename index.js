import 'dotenv/config';
import { Client, GatewayIntentBits, Events } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
  AudioPlayerStatus
} from '@discordjs/voice';
import play from 'play-dl';
import ffmpeg from 'ffmpeg-static';

// Ustawiamy ścieżkę do ffmpeg dla @discordjs/voice / prism-media
if (ffmpeg) {
  process.env.FFMPEG_PATH = ffmpeg;
}

const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('Brak zmiennej środowiskowej DISCORD_TOKEN. Ustaw ją w pliku .env lub w zmiennych środowiskowych Railway.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// Prosty storage: player na każdy serwer (guild)
const guildPlayers = new Map(); // guildId -> { connection, player }

function getOrCreatePlayer(interaction) {
  const guildId = interaction.guild.id;
  let data = guildPlayers.get(guildId);

  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    throw new Error('Użytkownik nie jest na żadnym kanale głosowym.');
  }

  if (!data || !data.connection || data.connection.state.status === 'destroyed') {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });

    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
      // Po zakończeniu utworu nic nie robimy – bot może zostać na kanale.
    });

    player.on('error', error => {
      console.error('Błąd odtwarzacza:', error);
    });

    data = { connection, player };
    guildPlayers.set(guildId, data);
  }

  return data;
}

async function playFromUrl(interaction, url) {
  try {
    await interaction.deferReply();

    const { player } = getOrCreatePlayer(interaction);

    if (!play.is_valid_url(url)) {
      await interaction.editReply('Ten link wygląda na nieprawidłowy. Upewnij się, że podałeś pełny adres (np. https://youtube.com/...).');
      return;
    }

    const validation = await play.validate(url).catch(() => null);

    if (!validation || validation === 'search') {
      await interaction.editReply('Ten typ linku nie jest obsługiwany albo wygląda jak wyszukiwarka, a nie bezpośredni link do utworu.');
      return;
    }

    let title = 'Nieznany tytuł';
    try {
      const info = await play.video_basic_info(url);
      title = info?.video_details?.title || title;
    } catch {
      // brak tytułu to nie krytyczny błąd
    }

    // Strumień z play-dl
    const stream = await play.stream(url, {
      // bez specjalnych trybów, standardowy stream dla @discordjs/voice
    });

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type
    });

    player.play(resource);

    await interaction.editReply(`▶️ Odtwarzam: **${title}**`);
  } catch (error) {
    console.error('Błąd przy odtwarzaniu z URL:', error);
    const msg = `Wystąpił błąd podczas próby odtworzenia tego linku.\nSzczegóły: \`${error.message || error}\``;
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(msg);
      } else {
        await interaction.editReply(msg);
      }
    } catch (e) {
      console.error('Błąd przy wysyłaniu odpowiedzi na interakcję (URL):', e);
    }
  }
}

async function playFromAttachment(interaction, attachment) {
  try {
    await interaction.deferReply();

    const { player } = getOrCreatePlayer(interaction);

    const allowedExtensions = ['.mp3', '.ogg', '.webm', '.wav', '.flac', '.m4a'];
    const name = attachment.name?.toLowerCase() || '';
    const hasAllowedExtension = allowedExtensions.some(ext => name.endsWith(ext));

    if (!hasAllowedExtension) {
      await interaction.editReply(
        'Ten typ pliku może nie być obsługiwany. Spróbuj wgrać plik w formacie MP3 / OGG / WEBM / WAV / FLAC / M4A.'
      );
      return;
    }

    // Używamy URL pliku jako wejścia dla FFmpeg (ffmpeg-static)
    // FFmpeg pobiera plik z HTTPS i konwertuje do Opus pod spodem.
    const resource = createAudioResource(attachment.url);

    player.play(resource);

    await interaction.editReply(`▶️ Odtwarzam plik: **${attachment.name}**`);
  } catch (error) {
    console.error('Błąd przy odtwarzaniu pliku:', error);
    const msg = `Wystąpił błąd podczas próby odtworzenia wgranego pliku.\nSzczegóły: \`${error.message || error}\``;
    try {
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply(msg);
      } else {
        await interaction.editReply(msg);
      }
    } catch (e) {
      console.error('Błąd przy wysyłaniu odpowiedzi na interakcję (plik):', e);
    }
  }
}

async function stopPlayback(interaction) {
  const guildId = interaction.guild.id;
  const data = guildPlayers.get(guildId);

  if (!data) {
    await interaction.reply({ content: 'Bot nie odtwarza teraz żadnej muzyki.', ephemeral: true });
    return;
  }

  const { player, connection } = data;
  try {
    player.stop(true);
    connection.destroy();
  } catch (error) {
    console.error('Błąd przy zatrzymywaniu odtwarzania:', error);
  } finally {
    guildPlayers.delete(guildId);
  }

  await interaction.reply('⏹️ Odtwarzanie zatrzymane, bot opuszcza kanał głosowy.');
}

client.once(Events.ClientReady, (c) => {
  console.log(`Zalogowano jako ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  try {
    if (interaction.commandName === 'graj') {
      const url = interaction.options.getString('url', true);

      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel) {
        await interaction.reply({
          content: 'Musisz być na kanale głosowym, żeby użyć tej komendy.',
          ephemeral: true
        });
        return;
      }

      await playFromUrl(interaction, url);
    }

    if (interaction.commandName === 'graj-plik') {
      const attachment = interaction.options.getAttachment('plik', true);

      const voiceChannel = interaction.member?.voice?.channel;
      if (!voiceChannel) {
        await interaction.reply({
          content: 'Musisz być na kanale głosowym, żeby użyć tej komendy.',
          ephemeral: true
        });
        return;
      }

      await playFromAttachment(interaction, attachment);
    }

    if (interaction.commandName === 'stop') {
      await stopPlayback(interaction);
    }
  } catch (error) {
    console.error('Błąd w handlerze InteractionCreate:', error);
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: 'Wystąpił nieoczekiwany błąd przy obsłudze komendy.',
          ephemeral: true
        });
      } catch (e) {
        console.error('Błąd przy wysyłaniu awaryjnej odpowiedzi:', e);
      }
    }
  }
});

client.login(token);
