class DomainError(Exception):
    code: str = "domain_error"

    def __init__(self, message: str = "", code: str | None = None):
        super().__init__(message)
        if code is not None:
            self.code = code
        self.message = message


class NotFound(DomainError):
    code = "not_found"

    def __init__(self, message: str = "Não encontrado"):
        super().__init__(message)


class Conflict(DomainError):
    def __init__(self, code: str, message: str = ""):
        super().__init__(message, code=code)
