export default function logger(
  msg,
  { bgcolor = '#009688', fgcolor = '#fff', args }
) {
  console.log(
    `%c${msg}`,
    [
      `background-color:${bgcolor}`,
      `color:${fgcolor}`,
      'padding:0.2em',
      'border-radius:0.4em',
    ].join(';'),
    args || ''
  );
}
