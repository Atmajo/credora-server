export const generateOtp = () => {
  const values = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  let otp: string = '';

  for (let index = 0; index < 6; index++) {
    const idx = Math.floor(Math.random() * values.length);
    const element = values[idx];

    otp += element;
  }

  return otp;
};
