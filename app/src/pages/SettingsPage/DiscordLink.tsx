import discordIcon from './discord.svg';
import { Box, Link } from '@mui/material';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import Section from './Section.tsx';
export default function DiscordLink() {
  const discordInviteLink = 'https://discord.gg/JpArXnBgEj';

  return (
    <Section title="Support & Feature Requests" icon={ <ForumOutlinedIcon/> }>
      <Box sx={ { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 } }>
        <Link
          href={ discordInviteLink }
          target="_blank"
          rel="noopener noreferrer"
          underline="none"
          sx={ { display: 'flex', alignItems: 'center', gap: 1, minHeight: 44, fontSize: 13 } }
        >
          Join us on Discord!
          <ArrowOutwardIcon sx={ { fontSize: 16, color: 'text.secondary' } }/>
        </Link>
        <Link href={ discordInviteLink } target="_blank" rel="noopener noreferrer">
          <img src={ discordIcon } alt="Join our Discord" width={ 36 } height={ 36 }/>
        </Link>
      </Box>
    </Section>
  );
}
