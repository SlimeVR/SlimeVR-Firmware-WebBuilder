import { ApiProperty } from '@nestjs/swagger';
import { BoardType } from './firmware-board.dto';

export class BoardTypeBoard {
  @ApiProperty({ enum: BoardType })
  public boardType: BoardType;

  @ApiProperty()
  public board: string;
}
