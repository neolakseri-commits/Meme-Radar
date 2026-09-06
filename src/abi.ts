import { parseAbi } from "viem";

export const factoryAbi = parseAbi([
  "struct LaunchedToken { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }",
  "function getLaunchedToken(address token) view returns (LaunchedToken)",
  "event TokenLaunched(address indexed token, address indexed curve, address indexed deployer, address pairToken, uint256 launchConfigId, uint256 graduationThreshold)",
  "event PoolGraduated(address indexed token, uint256 positionId, uint256 tokenAmount, uint256 pairTokenAmount)",
]);

export const curveAbi = parseAbi([
  "function getReserves() view returns (uint256 quoteReserve, uint256 tokenReserve)",
  "function realQuoteReserve() view returns (uint256)",
  "function sellableTokens() view returns (uint256)",
  "function reservedTokens() view returns (uint256)",
  "function graduationThreshold() view returns (uint256)",
  "function creatorTaxBps() view returns (uint256)",
  "function currentSnipeTaxBps(address recipient) view returns (uint256)",
  "function readyToGraduate() view returns (bool)",
  "function graduated() view returns (bool)",
  "function pairToken() view returns (address)",
  "function launchedAt() view returns (uint256)",
  "event CurveBuy(address indexed buyer, address indexed recipient, uint256 quoteIn, uint256 tokensOut, uint256 fee, uint256 tax)",
  "event CurveSell(address indexed seller, address indexed recipient, uint256 tokensIn, uint256 quoteOut, uint256 fee, uint256 tax)",
]);

export const tokenAbi = parseAbi([
  "struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }",
  "function getTokenInfo() view returns (address tokenDeployer, string tokenLogo, string tokenDescription, Socials tokenSocials)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
]);

export const routerAbi = parseAbi([
  "struct Socials { string twitter; string telegram; string discord; string website; string farcaster; }",
  "struct TokenParams { string name; string symbol; string logo; string description; Socials socials; address creatorFeeRecipient; uint16 creatorTaxBps; bool buybackEnabled; bytes32 expectedEconomics; bytes32 salt; }",
  "function launchAndBuy(TokenParams params, uint256 launchConfigId, address pairToken, uint256 quoteIn, uint256 minTokensOut, address recipient, address[] snipeTaxExemptions) payable returns (address token, address curve, uint256 tokensOut)",
  "event Launched(address indexed token, address indexed curve, address indexed recipient, address launcher, uint256 quoteSpent, uint256 tokensReceived)",
]);
