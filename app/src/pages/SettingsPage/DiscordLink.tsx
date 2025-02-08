import discordIcon from './discord.svg';
import { Box, Link, Typography } from '@mui/material';

export default function DiscordLink() {
  const discordInviteLink = 'https://discord.gg/JpArXnBgEj';

  return (
    <Box sx={ { textAlign: 'center' } }>
      <Typography variant='h5'>
        Support & Feature Requests
      </Typography>
      <Link href={ discordInviteLink } target="_blank" rel="noopener noreferrer">
        Join us on Discord!
      </Link>
      <br />
      <Link href={ discordInviteLink } target="_blank" rel="noopener noreferrer">
        <img src={ discordIcon } alt="Join our Discord" width={ 100 } height={ 100 }/>
      </Link>
    </Box>
  );
}
