"use client";

const DolbySvg = ({ active }) => (
  // <svg
  //   viewBox="0 0 24 24"
  //   className="w-5 h-5 transition-colors duration-200"
  //   fill={active ? "#fa4565" : "currentColor"}
  //   xmlns="http://www.w3.org/2000/svg"
  // >
  //   <path d="M3 4h6c4.418 0 8 3.582 8 8s-3.582 8-8 8H3V4zm18 0v16h-6c-4.418 0-8-3.582-8-8s3.582-8 8-8h6z" />
  // </svg>
  <svg fill={active ? "#fa4565" : "currentColor"} width="25" height="25" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M24 20.352V3.648H0v16.704zM18.433 5.806h2.736v12.387h-2.736c-2.839 0-5.214-2.767-5.214-6.194s2.375-6.193 5.214-6.193m-15.602 0h2.736c2.839 0 5.214 2.767 5.214 6.194s-2.374 6.194-5.214 6.194H2.831z" /></svg>
);

export default DolbySvg;
